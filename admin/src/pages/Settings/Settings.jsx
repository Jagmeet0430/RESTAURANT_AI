import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import LinkIcon from "@mui/icons-material/Link";
import LocalPrintshopIcon from "@mui/icons-material/LocalPrintshop";
import LockIcon from "@mui/icons-material/Lock";
import PaletteIcon from "@mui/icons-material/Palette";
import PhoneIcon from "@mui/icons-material/Phone";
import SettingsIcon from "@mui/icons-material/Settings";
import StorefrontIcon from "@mui/icons-material/Storefront";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { PageHeader, StatCard, StatGrid } from "../../components/common/PageKit";
import { settingsService } from "../../services/settings";

const STORAGE_KEY = "restaurantai_settings";

const defaultSettings = {
  restaurantName: "MAHESH Sweets & Bakers",
  gst: "",
  address: "Jaja Chowk, Opp. State Bank of India, Tanda, Punjab-144024, India",
  phone: "",
  email: "",
  footerText: "Thank You",
  receiptWidth: "80",
  autoOpenReceiptAfterPayment: "false",
  openingTime: "10:00",
  closingTime: "22:00",
  logo: "",
  password: "",
  theme: "light",
  kioskDisplayMode: "auto",
};

const placeholderValues = {
  restaurantName: ["Restaurant AI", "RestaurantAI", "RESTAURANT NAME"],
  gst: ["27ABCDE1234F1Z5"],
  address: ["123 Main Street, Bengaluru", "123 Main St", "123 Main St, Apt 4B"],
  phone: ["+91 98765 43210", "+91-9876543210", "9876543210"],
  email: ["hello@restaurantai.com", "admin@restaurantai.com", "customer@email.com"],
};

function cleanSettingValue(field, value) {
  const text = String(value ?? "").trim();
  if (field === "kioskDisplayMode") {
    const normalized = text.toLowerCase();
    return ["auto", "landscape", "portrait"].includes(normalized) ? normalized : defaultSettings.kioskDisplayMode;
  }

  if (field === "receiptWidth") {
    return ["58", "80"].includes(text) ? text : defaultSettings.receiptWidth;
  }

  if (field === "autoOpenReceiptAfterPayment") {
    return text.toLowerCase() === "true" ? "true" : "false";
  }

  const isPlaceholder = placeholderValues[field]?.some(
    (placeholder) => text.toLowerCase() === placeholder.toLowerCase()
  );

  if (!isPlaceholder) {
    return text;
  }

  return field === "restaurantName" || field === "address" ? defaultSettings[field] : "";
}

function normalizeSettings(settings = {}) {
  return Object.keys(defaultSettings).reduce((normalized, field) => {
    const value =
      settings[field] === undefined || settings[field] === null
        ? defaultSettings[field]
        : settings[field];
    normalized[field] = cleanSettingValue(field, value);
    return normalized;
  }, {});
}

function settingsSignature(settings = {}) {
  const comparable = normalizeSettings({ ...settings, password: "" });
  return JSON.stringify(comparable);
}

const themeOptions = [
  {
    value: "light",
    label: "Light",
    helper: "Bright view for daily admin work",
  },
  {
    value: "comfort",
    label: "Comfort",
    helper: "Softer background for long sessions",
  },
  {
    value: "dark",
    label: "Dark",
    helper: "Lower brightness for evening use",
  },
];

const kioskDisplayModes = [
  {
    value: "auto",
    label: "Auto",
    helper: "Adapts to current screen dimensions",
  },
  {
    value: "landscape",
    label: "Landscape",
    helper: "Optimized for wide restaurant screens",
  },
  {
    value: "portrait",
    label: "Portrait",
    helper: "Optimized for vertical kiosk screens",
  },
];

const receiptWidthOptions = [
  { value: "80", label: "80mm", helper: "Primary thermal receipt layout" },
  { value: "58", label: "58mm", helper: "Compact printer layout" },
];

function loadSavedSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeSettings(JSON.parse(saved)) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.adminTheme = theme;
}

function cacheSettings(settings) {
  const cached = normalizeSettings({ ...settings, password: "" });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  window.dispatchEvent(new CustomEvent("restaurantai-settings-updated", { detail: cached }));
}

function validateSettings(settings, includePassword = false) {
  if (!settings.restaurantName.trim()) {
    return "Restaurant name is required because customers see it on the website.";
  }

  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
    return "Enter a valid email address or leave it blank.";
  }

  if (includePassword && settings.password && settings.password.length < 6) {
    return "New password must be at least 6 characters.";
  }

  return "";
}

function saveStatusLabel(status, lastSavedAt) {
  if (status === "loading") return "Loading settings...";
  if (status === "pending") return "Unsaved changes. Click Save Settings Now or wait for auto-save.";
  if (status === "saving") return "Saving changes...";
  if (status === "offline") return "Saved in this browser. Backend sync is unavailable.";
  if (status === "error") return "Changes need attention.";
  if (status === "saved" && lastSavedAt) return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return "Changes auto-save after you edit.";
}

function Settings() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(loadSavedSettings);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [error, setError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const skipAutoSaveRef = useRef(true);
  const lastServerSettingsRef = useRef("");

  useEffect(() => {
    applyTheme(formData.theme);
  }, [formData.theme]);

  const loadSettings = useCallback(async () => {
    setSaveStatus("loading");

    try {
      const response = await settingsService.getSettings();
      const nextSettings = normalizeSettings({ ...(response.data || {}), password: "" });
      skipAutoSaveRef.current = true;
      setFormData(nextSettings);
      cacheSettings(nextSettings);
      lastServerSettingsRef.current = settingsSignature(nextSettings);
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      setError("");
    } catch (loadError) {
      const cachedSettings = loadSavedSettings();
      skipAutoSaveRef.current = true;
      setFormData(cachedSettings);
      setHasUnsavedChanges(false);
      setSaveStatus("offline");
      setError(loadError?.response?.data?.message || "Backend settings are unavailable. Changes will still stay in this browser.");
    } finally {
      setSettingsReady(true);
    }
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(loadSettings, 0);
    return () => window.clearTimeout(loadId);
  }, [loadSettings]);

  const publicInfoComplete = useMemo(() => {
    const fields = ["restaurantName", "address", "openingTime", "closingTime"];
    const completed = fields.filter((field) => String(formData[field] || "").trim()).length;
    return `${completed}/${fields.length}`;
  }, [formData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError("");
    setHasUnsavedChanges(true);
    setSaveStatus("pending");
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleThemeChange = (theme) => {
    setError("");
    setHasUnsavedChanges(true);
    setSaveStatus("pending");
    setFormData((prev) => ({ ...prev, theme }));
  };

  const handleKioskDisplayModeChange = (kioskDisplayMode) => {
    setError("");
    setHasUnsavedChanges(true);
    setSaveStatus("pending");
    setFormData((prev) => ({ ...prev, kioskDisplayMode }));
  };

  const handleReceiptWidthChange = (receiptWidth) => {
    setError("");
    setHasUnsavedChanges(true);
    setSaveStatus("pending");
    setFormData((prev) => ({ ...prev, receiptWidth }));
  };

  const handleAutoOpenReceiptChange = (autoOpenReceiptAfterPayment) => {
    setError("");
    setHasUnsavedChanges(true);
    setSaveStatus("pending");
    setFormData((prev) => ({ ...prev, autoOpenReceiptAfterPayment }));
  };

  const saveSettings = useCallback(
    async ({ includePassword = false } = {}) => {
      const validationError = validateSettings(formData, includePassword);
      if (validationError) {
        setSaveStatus("error");
        setError(validationError);
        return;
      }

      const payload = {
        ...formData,
        password: includePassword ? formData.password : "",
      };

      cacheSettings({ ...formData, password: "" });
      setSaveStatus("saving");

      try {
        const response = await settingsService.updateSettings(payload);
        const serverSettings = normalizeSettings(response.data || {});
        const nextSettings = {
          ...serverSettings,
          password: includePassword ? "" : formData.password,
        };

        skipAutoSaveRef.current = true;
        setFormData(nextSettings);
        cacheSettings(nextSettings);
        lastServerSettingsRef.current = settingsSignature(nextSettings);
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setError("");
      } catch (saveError) {
        setHasUnsavedChanges(true);
        setSaveStatus("offline");
        setLastSavedAt(new Date());
        setError(saveError?.response?.data?.message || "Backend sync failed. Settings were saved in this browser only.");
      }
    },
    [formData]
  );

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    const saveId = window.setTimeout(() => {
      saveSettings({ includePassword: false });
    }, 700);

    return () => window.clearTimeout(saveId);
  }, [formData, saveSettings, settingsReady]);

  useEffect(() => {
    if (!settingsReady) {
      return undefined;
    }

    const pollBackendSettings = async () => {
      if (hasUnsavedChanges || saveStatus === "saving") {
        return;
      }

      try {
        const response = await settingsService.getSettings();
        const nextSettings = normalizeSettings({ ...(response.data || {}), password: formData.password });
        const nextSignature = settingsSignature(nextSettings);

        if (!lastServerSettingsRef.current) {
          lastServerSettingsRef.current = nextSignature;
          return;
        }

        if (nextSignature !== lastServerSettingsRef.current) {
          skipAutoSaveRef.current = true;
          setFormData(nextSettings);
          cacheSettings(nextSettings);
          lastServerSettingsRef.current = nextSignature;
          setSaveStatus("saved");
          setLastSavedAt(new Date());
          setError("");
        }
      } catch {
        // Keep the current form values if the background refresh misses once.
      }
    };

    const pollId = window.setInterval(pollBackendSettings, 5000);
    return () => window.clearInterval(pollId);
  }, [formData.password, hasUnsavedChanges, saveStatus, settingsReady]);

  const handleSave = () => {
    saveSettings({ includePassword: Boolean(formData.password) });
  };

  const statusMessage = saveStatusLabel(saveStatus, lastSavedAt);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Restaurant Setup"
        title="Settings"
        subtitle="Keep customer-facing restaurant details, billing identity, contact options, and admin preferences clear and easy to update."
      />

      <StatGrid>
        <StatCard
          label="Public profile"
          value={publicInfoComplete}
          helper="Important customer details filled"
          icon={<StorefrontIcon />}
          accent="#1976d2"
        />
        <StatCard
          label="Billing identity"
          value={formData.gst ? "GST added" : "GST missing"}
          helper={`${formData.receiptWidth}mm receipt layout`}
          icon={<VerifiedUserIcon />}
          accent="#059669"
        />
        <StatCard
          label="Admin theme"
          value={themeOptions.find((item) => item.value === formData.theme)?.label || "Light"}
          helper="Applies immediately and auto-saves"
          icon={<SettingsIcon />}
          accent="#7c3aed"
        />
        <StatCard
          label="Kiosk display"
          value={kioskDisplayModes.find((item) => item.value === formData.kioskDisplayMode)?.label || "Auto"}
          helper="Used only by customer kiosk mode"
          icon={<StorefrontIcon />}
          accent="#c81f25"
        />
      </StatGrid>

      <Alert severity={saveStatus === "error" ? "error" : saveStatus === "offline" ? "warning" : "info"} sx={{ mb: 3 }}>
        {statusMessage}
      </Alert>

      {error && (
        <Alert severity={saveStatus === "offline" ? "warning" : "error"} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Public Restaurant Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Customers see these details on the live website and order messages.
                    </Typography>
                  </Box>
                  <Chip label="Customer visible" color="primary" variant="outlined" />
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Restaurant name"
                      name="restaurantName"
                      value={formData.restaurantName}
                      onChange={handleChange}
                      helperText="Example: MAHESH Sweets & Bakers"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <StorefrontIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="GST number"
                      name="gst"
                      value={formData.gst}
                      onChange={handleChange}
                      helperText="Optional for customers, useful for billing."
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Restaurant address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      multiline
                      rows={3}
                      helperText="Use a complete address customers and delivery partners can understand."
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Receipt footer"
                      name="footerText"
                      value={formData.footerText}
                      onChange={handleChange}
                      helperText="Printed at the bottom of thermal bills and receipts."
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      select
                      label="Receipt width"
                      name="receiptWidth"
                      value={formData.receiptWidth}
                      onChange={handleChange}
                      helperText="Default width for browser and thermal printer receipts."
                    >
                      {receiptWidthOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label} - {option.helper}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      select
                      label="After payment"
                      name="autoOpenReceiptAfterPayment"
                      value={formData.autoOpenReceiptAfterPayment}
                      onChange={handleChange}
                      helperText="Controls whether settlement opens the receipt page automatically."
                    >
                      <MenuItem value="false">Do not auto-open receipt</MenuItem>
                      <MenuItem value="true">Open receipt automatically</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Opening time"
                      name="openingTime"
                      type="time"
                      value={formData.openingTime}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTimeIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Closing time"
                      name="closingTime"
                      type="time"
                      value={formData.closingTime}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTimeIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 900 }}>
                  Contact and Website Details
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  These make it easier for customers to call, message, and recognize your restaurant.
                </Typography>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Customer phone / WhatsApp"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      helperText="Used for order requests and customer support."
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      helperText="Optional contact for customers and suppliers."
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AlternateEmailIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Logo URL"
                      name="logo"
                      value={formData.logo}
                      onChange={handleChange}
                      placeholder="https://example.com/logo.png"
                      helperText="Optional. Add a public image URL if you want a restaurant logo."
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 900 }}>
                  Receipt Printing
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Configure browser printing for standard Windows thermal printer drivers.
                </Typography>

                <Stack direction={{ xs: "column", sm: "row", lg: "column" }} spacing={1} sx={{ mb: 2 }}>
                  {receiptWidthOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={formData.receiptWidth === option.value ? "contained" : "outlined"}
                      onClick={() => handleReceiptWidthChange(option.value)}
                      startIcon={<LocalPrintshopIcon />}
                      sx={{ justifyContent: "flex-start", py: 1.2 }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </Stack>

                <Stack direction={{ xs: "column", sm: "row", lg: "column" }} spacing={1} sx={{ mb: 2 }}>
                  <Button
                    variant={formData.autoOpenReceiptAfterPayment === "true" ? "contained" : "outlined"}
                    onClick={() => handleAutoOpenReceiptChange("true")}
                    sx={{ justifyContent: "flex-start", py: 1.2 }}
                  >
                    Open receipt after payment
                  </Button>
                  <Button
                    variant={formData.autoOpenReceiptAfterPayment === "false" ? "contained" : "outlined"}
                    onClick={() => handleAutoOpenReceiptChange("false")}
                    sx={{ justifyContent: "flex-start", py: 1.2 }}
                  >
                    Keep operator on bills
                  </Button>
                </Stack>

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<LocalPrintshopIcon />}
                  onClick={() => navigate("/receipt/test/preview?print=1")}
                >
                  Print Test Receipt
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 900 }}>
                  Kiosk
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Control how the self-ordering screen arranges itself. This does not rotate the Windows display.
                </Typography>

                <Stack direction={{ xs: "column", sm: "row", lg: "column" }} spacing={1} sx={{ mb: 2 }}>
                  {kioskDisplayModes.map((mode) => (
                    <Button
                      key={mode.value}
                      variant={formData.kioskDisplayMode === mode.value ? "contained" : "outlined"}
                      onClick={() => handleKioskDisplayModeChange(mode.value)}
                      sx={{ justifyContent: "flex-start", py: 1.2 }}
                    >
                      {mode.label}
                    </Button>
                  ))}
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {kioskDisplayModes.find((item) => item.value === formData.kioskDisplayMode)?.helper}
                </Typography>

                <Stack spacing={1}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 900 }}>Landscape preview</Typography>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 1, height: 46 }}>
                      <Box sx={{ width: "22%", bgcolor: "#fff3cd", borderRadius: 1 }} />
                      <Box sx={{ flex: 1, bgcolor: "#fee2e2", borderRadius: 1 }} />
                      <Box sx={{ width: "28%", bgcolor: "#dcfce7", borderRadius: 1 }} />
                    </Stack>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 900 }}>Portrait preview</Typography>
                    <Stack spacing={0.75} sx={{ mt: 1 }}>
                      <Box sx={{ height: 12, bgcolor: "#fff3cd", borderRadius: 1 }} />
                      <Box sx={{ height: 34, bgcolor: "#fee2e2", borderRadius: 1 }} />
                      <Box sx={{ height: 18, bgcolor: "#dcfce7", borderRadius: 1 }} />
                    </Stack>
                  </Paper>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 900 }}>
                  Admin Preferences
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  These options affect the admin dashboard experience.
                </Typography>

                <TextField
                  fullWidth
                  label="New password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  helperText="Leave empty if you do not want to change it."
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  select
                  label="Dashboard theme"
                  name="theme"
                  value={formData.theme}
                  onChange={handleChange}
                  helperText="This dropdown now changes the admin theme immediately."
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PaletteIcon />
                      </InputAdornment>
                    ),
                  }}
                >
                  {themeOptions.map((theme) => (
                    <MenuItem key={theme.value} value={theme.value}>
                      {theme.label} - {theme.helper}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack spacing={1}>
                  {themeOptions.map((theme) => (
                    <Paper
                      key={theme.value}
                      variant="outlined"
                      onClick={() => handleThemeChange(theme.value)}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        cursor: "pointer",
                        borderColor: formData.theme === theme.value ? "primary.main" : "divider",
                        bgcolor: formData.theme === theme.value ? "primary.50" : "background.paper",
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography sx={{ fontWeight: 900 }}>{theme.label}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {theme.helper}
                          </Typography>
                        </Box>
                        {formData.theme === theme.value && <Chip label="Selected" color="primary" size="small" />}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Customer Preview
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Quick check of what customers understand from your setup.
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography sx={{ fontWeight: 900 }}>{formData.restaurantName || "Restaurant name"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formData.address || "Address not added"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formData.openingTime} - {formData.closingTime}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formData.phone || "Phone not added"}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>

            <Button
              variant="contained"
              size="large"
              onClick={handleSave}
              disabled={saveStatus === "saving" || saveStatus === "loading"}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : formData.password
                  ? "Save Settings and Password"
                  : hasUnsavedChanges
                    ? "Save Pending Changes"
                    : "Save Settings Now"}
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Settings;
