import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  restaurantName: "Restaurant AI",
  gst: "27ABCDE1234F1Z5",
  address: "123 Main Street, Bengaluru",
  phone: "+91 98765 43210",
  email: "hello@restaurantai.com",
  openingTime: "10:00",
  closingTime: "22:00",
  logo: "",
  password: "",
  theme: "light",
};

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

function loadSavedSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.adminTheme = theme;
}

function cacheSettings(settings) {
  const cached = { ...settings, password: "" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  window.dispatchEvent(new CustomEvent("restaurantai-settings-updated", { detail: cached }));
}

function validateSettings(settings, includePassword = false) {
  if (!settings.restaurantName.trim()) {
    return "Restaurant name is required because customers see it on the website.";
  }

  if (!settings.phone.trim()) {
    return "Phone number is required so customers can contact the restaurant.";
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
  if (status === "saving") return "Auto-saving changes...";
  if (status === "offline") return "Saved in this browser. Backend sync is unavailable.";
  if (status === "error") return "Changes need attention.";
  if (status === "saved" && lastSavedAt) return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return "Changes auto-save after you edit.";
}

function Settings() {
  const [formData, setFormData] = useState(loadSavedSettings);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [error, setError] = useState("");
  const skipAutoSaveRef = useRef(true);

  useEffect(() => {
    applyTheme(formData.theme);
  }, [formData.theme]);

  const loadSettings = useCallback(async () => {
    setSaveStatus("loading");

    try {
      const response = await settingsService.getSettings();
      const nextSettings = { ...defaultSettings, ...(response.data || {}), password: "" };
      skipAutoSaveRef.current = true;
      setFormData(nextSettings);
      cacheSettings(nextSettings);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      setError("");
    } catch (loadError) {
      const cachedSettings = loadSavedSettings();
      skipAutoSaveRef.current = true;
      setFormData(cachedSettings);
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
    const fields = ["restaurantName", "address", "phone", "openingTime", "closingTime"];
    const completed = fields.filter((field) => String(formData[field] || "").trim()).length;
    return `${completed}/${fields.length}`;
  }, [formData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError("");
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleThemeChange = (theme) => {
    setFormData((prev) => ({ ...prev, theme }));
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
        const serverSettings = { ...defaultSettings, ...(response.data || {}) };
        const nextSettings = {
          ...serverSettings,
          password: includePassword ? "" : formData.password,
        };

        skipAutoSaveRef.current = true;
        setFormData(nextSettings);
        cacheSettings(nextSettings);
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setError("");
      } catch (saveError) {
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
          helper="Used for invoices and records"
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
                      helperText="Example: RestaurantAI Bakery and Quick Bites"
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

            <Button variant="contained" size="large" onClick={handleSave} disabled={saveStatus === "saving"}>
              {formData.password ? "Save Settings and Password" : "Save Settings Now"}
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Settings;
