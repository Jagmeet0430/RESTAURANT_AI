import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PaidIcon from "@mui/icons-material/Paid";
import RunningWithErrorsIcon from "@mui/icons-material/RunningWithErrors";
import { couponsService } from "../../services/coupons";
import { PageHeader, StatCard, StatGrid } from "../../components/common/PageKit";

const FALLBACK_COUPONS = [
  {
    id: 1,
    code: "SAVE20",
    discount_type: "Percentage",
    discount_value: 20,
    expiry_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    is_active: true,
  },
];

const EMPTY_FORM = {
  code: "SAVE20",
  discount_type: "Percentage",
  discount_value: "20",
  expiry_date: "",
  is_active: true,
};

function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await couponsService.getAllCoupons();
      if (response.success) {
        setCoupons(response.data || []);
        setUsingFallback(false);
      } else {
        setCoupons(FALLBACK_COUPONS);
        setUsingFallback(true);
        setSnackbar({ open: true, message: response.message || "Showing sample coupons", severity: "warning" });
      }
    } catch (error) {
      setCoupons(FALLBACK_COUPONS);
      setUsingFallback(true);
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || "Backend unavailable. Showing sample coupons.",
        severity: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const formatDiscount = (coupon) => {
    const value = Number(coupon.discount_value || 0);
    return coupon.discount_type === "Percentage" ? `${value}%` : `Rs. ${value}`;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };

  const getStatus = (coupon) => {
    if (!coupon.is_active) return { label: "Inactive", color: "default" };
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) return { label: "Expired", color: "error" };
    return { label: "Active", color: "success" };
  };

  const stats = useMemo(() => {
    const active = coupons.filter((coupon) => getStatus(coupon).label === "Active").length;
    const expired = coupons.filter((coupon) => getStatus(coupon).label === "Expired").length;
    const best = [...coupons].sort((a, b) => Number(b.discount_value || 0) - Number(a.discount_value || 0))[0];
    return { active, expired, best };
  }, [coupons]);

  const openCreate = () => {
    setEditingCoupon(null);
    setForm({
      ...EMPTY_FORM,
      expiry_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const openEdit = (coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code || "",
      discount_type: coupon.discount_type || "Percentage",
      discount_value: String(coupon.discount_value || ""),
      expiry_date: coupon.expiry_date ? new Date(coupon.expiry_date).toISOString().slice(0, 10) : "",
      is_active: Boolean(coupon.is_active),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCoupon(null);
    setForm(EMPTY_FORM);
  };

  const buildPayload = () => ({
    code: form.code.trim().toUpperCase(),
    discount_type: form.discount_type,
    discount_value: Number(form.discount_value),
    expiry_date: form.expiry_date,
    is_active: form.is_active,
  });

  const handleSave = async () => {
    if (!form.code.trim() || !form.discount_value || !form.expiry_date) {
      setSnackbar({ open: true, message: "Code, discount, and expiry are required.", severity: "error" });
      return;
    }

    const payload = buildPayload();

    if (usingFallback) {
      if (editingCoupon) {
        setCoupons((prev) => prev.map((coupon) => (coupon.id === editingCoupon.id ? { ...coupon, ...payload } : coupon)));
      } else {
        setCoupons((prev) => [{ id: Date.now(), ...payload }, ...prev]);
      }
      closeDialog();
      setSnackbar({ open: true, message: editingCoupon ? "Coupon updated." : "Coupon created.", severity: "success" });
      return;
    }

    try {
      const response = editingCoupon
        ? await couponsService.updateCoupon(editingCoupon.id, payload)
        : await couponsService.createCoupon(payload);

      if (response.success) {
        if (editingCoupon) {
          setCoupons((prev) => prev.map((coupon) => (coupon.id === editingCoupon.id ? response.data : coupon)));
        } else {
          setCoupons((prev) => [response.data, ...prev]);
        }
        closeDialog();
        setSnackbar({ open: true, message: response.message, severity: "success" });
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to save coupon.", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Failed to save coupon.",
        severity: "error",
      });
    }
  };

  const handleDelete = async (coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;

    if (usingFallback) {
      setCoupons((prev) => prev.map((item) => (item.id === coupon.id ? { ...item, is_active: false } : item)));
      setSnackbar({ open: true, message: "Coupon deleted.", severity: "success" });
      return;
    }

    try {
      const response = await couponsService.deleteCoupon(coupon.id);
      if (response.success) {
        setCoupons((prev) => prev.map((item) => (item.id === coupon.id ? { ...item, is_active: false } : item)));
        setSnackbar({ open: true, message: "Coupon deleted.", severity: "success" });
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to delete coupon.", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Failed to delete coupon.",
        severity: "error",
      });
    }
  };

  const closeSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ padding: "20px" }}>
      <PageHeader
        badge="Offers"
        title="Coupons"
        subtitle="Create clear discount codes, see what is active, and avoid expired offers staying visible."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add Coupon
          </Button>
        }
      />

      <StatGrid>
        <StatCard label="Total coupons" value={coupons.length} helper="Created offers" icon={<LocalOfferIcon />} accent="#1976d2" />
        <StatCard label="Active offers" value={stats.active} helper="Ready for customers" icon={<PaidIcon />} accent="#059669" />
        <StatCard label="Expired" value={stats.expired} helper="Needs cleanup" icon={<RunningWithErrorsIcon />} accent="#dc2626" />
        <StatCard label="Largest discount" value={stats.best ? formatDiscount(stats.best) : "-"} helper={stats.best?.code || "No coupon"} icon={<LocalOfferIcon />} accent="#7c3aed" />
      </StatGrid>

      <TableContainer component={Paper} sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <Table>
          <TableHead>
            <TableRow style={{ background: "#f5f5f5" }}>
              <TableCell style={{ fontWeight: "bold" }}>Code</TableCell>
              <TableCell style={{ fontWeight: "bold" }}>Discount</TableCell>
              <TableCell style={{ fontWeight: "bold" }}>Expiry</TableCell>
              <TableCell style={{ fontWeight: "bold" }}>Status</TableCell>
              <TableCell style={{ fontWeight: "bold" }} align="center">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : coupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="textSecondary">No coupons found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              coupons.map((coupon) => {
                const status = getStatus(coupon);
                return (
                  <TableRow key={coupon.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{coupon.code}</TableCell>
                    <TableCell>{formatDiscount(coupon)}</TableCell>
                    <TableCell>{formatDate(coupon.expiry_date)}</TableCell>
                    <TableCell>
                      <Chip label={status.label} color={status.color} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="primary" onClick={() => openEdit(coupon)} title="Edit">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(coupon)} title="Delete">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingCoupon ? "Edit Coupon" : "Add Coupon"}</DialogTitle>
        <DialogContent sx={{ paddingTop: 2 }}>
          <TextField
            fullWidth
            label="Code"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
            margin="normal"
          />
          <TextField
            fullWidth
            select
            label="Discount Type"
            value={form.discount_type}
            onChange={(event) => setForm((prev) => ({ ...prev, discount_type: event.target.value }))}
            margin="normal"
          >
            <MenuItem value="Percentage">Percentage</MenuItem>
            <MenuItem value="Fixed">Fixed</MenuItem>
          </TextField>
          <TextField
            fullWidth
            label="Discount"
            type="number"
            value={form.discount_value}
            onChange={(event) => setForm((prev) => ({ ...prev, discount_value: event.target.value }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Expiry"
            type="date"
            value={form.expiry_date}
            onChange={(event) => setForm((prev) => ({ ...prev, expiry_date: event.target.value }))}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={closeSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Coupons;
