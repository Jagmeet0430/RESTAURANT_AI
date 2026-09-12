import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
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
  Paper,
  Snackbar,
  Stack,
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
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import QrCodeIcon from "@mui/icons-material/QrCode";
import RefreshIcon from "@mui/icons-material/Refresh";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatCard, StatGrid } from "../../components/common/PageKit";
import { tablesService } from "../../services/tables";

const EMPTY_FORM = {
  table_number: "",
  display_name: "",
  capacity: "4",
  is_active: true,
};

function statusColor(status) {
  if (status === "READY") return "success";
  if (status === "ACTIVE ORDER") return "primary";
  if (status === "PAYMENT PENDING") return "warning";
  if (status === "INACTIVE") return "default";
  return "info";
}

function qrFileName(table) {
  return `table-${String(table.table_number || table.id).replace(/[^a-z0-9-]/gi, "-")}-qr.png`;
}

async function buildQrImage(url) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 220,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });
}

function Tables() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [qrImages, setQrImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const response = await tablesService.getAllTables();
      if (response.success) {
        setTables(response.data || []);
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to load tables.", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Backend unavailable.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    let cancelled = false;
    async function renderQrs() {
      const entries = await Promise.all(
        tables.map(async (table) => [table.id, table.qr_url ? await buildQrImage(table.qr_url) : ""])
      );
      if (!cancelled) setQrImages(Object.fromEntries(entries));
    }
    renderQrs().catch((error) =>
      setSnackbar({ open: true, message: error.message || "Unable to generate QR images.", severity: "error" })
    );
    return () => {
      cancelled = true;
    };
  }, [tables]);

  const stats = useMemo(() => {
    const active = tables.filter((table) => table.is_active).length;
    const activeOrders = tables.reduce((sum, table) => sum + Number(table.active_orders || 0), 0);
    const ready = tables.reduce((sum, table) => sum + Number(table.ready_orders || 0), 0);
    return { active, activeOrders, ready };
  }, [tables]);

  const openCreate = () => {
    setEditingTable(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (table) => {
    setEditingTable(table);
    setForm({
      table_number: table.table_number || "",
      display_name: table.display_name || "",
      capacity: String(table.capacity || 4),
      is_active: Boolean(table.is_active),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTable(null);
    setForm(EMPTY_FORM);
  };

  const buildPayload = () => ({
    table_number: form.table_number.trim(),
    display_name: form.display_name.trim() || `Table ${form.table_number.trim()}`,
    capacity: Number(form.capacity) || 4,
    is_active: form.is_active,
  });

  const handleSave = async () => {
    if (!form.table_number.trim()) {
      setSnackbar({ open: true, message: "Table number is required.", severity: "error" });
      return;
    }

    try {
      const response = editingTable
        ? await tablesService.updateTable(editingTable.id, buildPayload())
        : await tablesService.createTable(buildPayload());
      if (response.success) {
        closeDialog();
        await loadTables();
        setSnackbar({ open: true, message: response.message, severity: "success" });
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to save table.", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Failed to save table.",
        severity: "error",
      });
    }
  };

  const toggleActive = async (table) => {
    try {
      const response = await tablesService.updateTable(table.id, { ...table, is_active: !table.is_active });
      if (response.success) {
        await loadTables();
        setSnackbar({
          open: true,
          message: `${table.display_name} ${table.is_active ? "deactivated" : "activated"}.`,
          severity: "success",
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Unable to update table.",
        severity: "error",
      });
    }
  };

  const regenerateQr = async (table) => {
    if (!window.confirm(`Regenerate QR for ${table.display_name}? The old QR sticker will stop working.`)) return;
    try {
      const response = await tablesService.regenerateQr(table.id);
      if (response.success) {
        await loadTables();
        setSnackbar({ open: true, message: response.message, severity: "success" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Unable to regenerate QR.",
        severity: "error",
      });
    }
  };

  const printQr = (table) => {
    const image = qrImages[table.id];
    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow || !image) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${table.display_name} QR</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; display: grid; place-items: center; min-height: 100vh; }
            .sheet { width: 320px; text-align: center; border: 1px solid #111827; padding: 24px; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            h2 { margin: 0 0 16px; font-size: 34px; }
            p { margin: 12px 0 0; font-size: 18px; font-weight: 700; }
            img { width: 240px; height: 240px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <h1>RestaurantAI</h1>
            <h2>${table.display_name}</h2>
            <img src="${image}" alt="${table.display_name} QR" />
            <p>Scan to Order</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Phase 9"
        title="Tables"
        subtitle="Manage table QR codes, active table orders, and ready/payment states for dine-in service."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadTables}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add table
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard label="Active tables" value={stats.active} helper={`${tables.length} total`} icon={<TableRestaurantIcon />} />
        <StatCard label="Active orders" value={stats.activeOrders} helper="Across table QR orders" icon={<RestaurantIcon />} accent="#7c3aed" />
        <StatCard label="Ready orders" value={stats.ready} helper="Ready for table handoff" icon={<QrCodeIcon />} accent="#16a34a" />
      </StatGrid>

      <TableContainer component={Paper} sx={{ border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafc" }}>
              <TableCell sx={{ fontWeight: 900 }}>Table</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Orders</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>QR code</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>URL</TableCell>
              <TableCell sx={{ fontWeight: 900 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : tables.length ? (
              tables.map((table) => (
                <TableRow key={table.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 900 }}>{table.display_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Number {table.table_number} - Capacity {table.capacity || 4}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={table.status_label || "AVAILABLE"} color={statusColor(table.status_label)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="text"
                      disabled={!Number(table.active_orders || 0)}
                      onClick={() => navigate(`/orders?table=${encodeURIComponent(table.table_number)}`)}
                    >
                      {Number(table.active_orders || 0)} active orders
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {Number(table.ready_orders || 0)} ready - {Number(table.payment_pending_orders || 0)} payment pending
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {qrImages[table.id] ? (
                      <img src={qrImages[table.id]} alt={`${table.display_name} QR`} width="88" height="88" />
                    ) : (
                      <CircularProgress size={24} />
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300 }}>
                    <Typography variant="caption" sx={{ wordBreak: "break-all" }}>
                      {table.qr_url}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button
                        size="small"
                        href={qrImages[table.id] || undefined}
                        download={qrFileName(table)}
                        disabled={!qrImages[table.id]}
                      >
                        Download
                      </Button>
                      <IconButton size="small" onClick={() => printQr(table)} title="Print QR">
                        <PrintIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => regenerateQr(table)} title="Regenerate QR">
                        <QrCodeIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => openEdit(table)} title="Edit table">
                        <EditIcon />
                      </IconButton>
                      <Switch checked={Boolean(table.is_active)} onChange={() => toggleActive(table)} inputProps={{ "aria-label": "Toggle active" }} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6}>
                  <Alert severity="info">No tables yet. Add Table 1, Table 2, and so on to generate offline QR codes.</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingTable ? "Edit table" : "Add table"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Table number"
              value={form.table_number}
              onChange={(event) => setForm((prev) => ({ ...prev, table_number: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Display name"
              value={form.display_name}
              placeholder={form.table_number ? `Table ${form.table_number}` : "Table 7"}
              onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Capacity"
              type="number"
              value={form.capacity}
              onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
              }
              label="Active QR"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Tables;
