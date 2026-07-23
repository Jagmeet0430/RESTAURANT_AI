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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SearchIcon from "@mui/icons-material/Search";
import StoreIcon from "@mui/icons-material/Store";

import { PageHeader, SectionCard, StatCard, StatGrid } from "../../components/common/PageKit";
import { inventoryService, supplierService } from "../../services/inventory";

const emptyItemForm = {
  ingredient_name: "",
  quantity: "",
  unit: "kg",
  minimum_level: "",
  cost_per_unit: "",
  expiry_date: "",
  supplier_id: "",
  menu_id: "",
  barcode: "",
  stock_per_sale: "1",
};

const emptySupplierForm = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
};

const emptyTransactionForm = {
  quantity: "",
  notes: "",
};

const fallbackSummary = {
  total_ingredients: 0,
  low_stock: 0,
  expiry_alerts: 0,
  out_of_stock: 0,
  total_suppliers: 0,
};

const formatDateForInput = (value) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

const formatDisplayDate = (value) => {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN");
};

const getStatusColor = (status) => {
  if (status === "Healthy") return "success";
  if (status === "Low stock" || status === "Expiring soon") return "warning";
  return "error";
};

const readPayload = (response) => response?.data ?? response;

const readArrayPayload = (response) => {
  const payload = readPayload(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const readObjectPayload = (response, fallback) => {
  const payload = readPayload(response);
  if (payload?.data && !Array.isArray(payload.data)) return payload.data;
  if (payload && !Array.isArray(payload)) return payload;
  return fallback;
};

function Inventory() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(fallbackSummary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [itemDialog, setItemDialog] = useState({ open: false, mode: "create", item: null });
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [transactionDialog, setTransactionDialog] = useState({
    open: false,
    item: null,
    type: "STOCK_IN",
  });
  const [transactionForm, setTransactionForm] = useState(emptyTransactionForm);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [itemsResponse, summaryResponse, suppliersResponse, transactionsResponse] =
        await Promise.all([
          inventoryService.getItems(),
          inventoryService.getSummary(),
          supplierService.getSuppliers(),
          inventoryService.getTransactions(),
        ]);

      setItems(readArrayPayload(itemsResponse));
      setSummary(readObjectPayload(summaryResponse, fallbackSummary));
      setSuppliers(readArrayPayload(suppliersResponse));
      setTransactions(readArrayPayload(transactionsResponse));
    } catch (err) {
      console.error("Inventory loading failed:", err);
      setError(err.response?.data?.message || "Could not load inventory data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.ingredient_name?.toLowerCase().includes(query) ||
        item.supplier_name?.toLowerCase().includes(query) ||
        item.menu_name?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const openEditIngredient = (item) => {
    setItemForm({
      ingredient_name: item.ingredient_name || "",
      quantity: item.quantity ?? "",
      unit: item.unit || "kg",
      minimum_level: item.minimum_level ?? "",
      cost_per_unit: item.cost_per_unit ?? "",
      expiry_date: formatDateForInput(item.expiry_date),
      supplier_id: item.supplier_id || "",
      menu_id: item.menu_id || "",
      barcode: item.barcode || "",
      stock_per_sale: item.stock_per_sale ?? "1",
    });
    setItemDialog({ open: true, mode: "edit", item });
  };

  const closeItemDialog = () => {
    setItemDialog({ open: false, mode: "create", item: null });
    setItemForm(emptyItemForm);
  };

  const saveIngredient = async () => {
    try {
      setSaving(true);
      setError("");

      const payload = {
        ...itemForm,
        supplier_id: itemForm.supplier_id || null,
      };

      if (itemDialog.mode === "edit") {
        await inventoryService.updateItem(itemDialog.item.id, payload);
      } else {
        await inventoryService.createItem(payload);
      }

      closeItemDialog();
      await loadInventoryData();
    } catch (err) {
      console.error("Save ingredient failed:", err);
      setError(err.response?.data?.message || "Could not save ingredient");
    } finally {
      setSaving(false);
    }
  };

  const deleteIngredient = async (item) => {
    const shouldDelete = window.confirm(`Delete ${item.ingredient_name}?`);
    if (!shouldDelete) return;

    try {
      setSaving(true);
      setError("");
      await inventoryService.deleteItem(item.id);
      await loadInventoryData();
    } catch (err) {
      console.error("Delete ingredient failed:", err);
      setError(err.response?.data?.message || "Could not delete ingredient");
    } finally {
      setSaving(false);
    }
  };

  const openAddSupplier = () => {
    setSupplierForm(emptySupplierForm);
    setSupplierDialogOpen(true);
  };

  const saveSupplier = async () => {
    try {
      setSaving(true);
      setError("");
      await supplierService.createSupplier(supplierForm);
      setSupplierDialogOpen(false);
      setSupplierForm(emptySupplierForm);
      await loadInventoryData();
    } catch (err) {
      console.error("Save supplier failed:", err);
      setError(err.response?.data?.message || "Could not save supplier");
    } finally {
      setSaving(false);
    }
  };

  const openTransactionDialog = (item, type) => {
    setTransactionForm(emptyTransactionForm);
    setTransactionDialog({ open: true, item, type });
  };

  const saveTransaction = async () => {
    try {
      setSaving(true);
      setError("");
      await inventoryService.createTransaction(transactionDialog.item.id, {
        transaction_type: transactionDialog.type,
        ...transactionForm,
      });
      setTransactionDialog({ open: false, item: null, type: "STOCK_IN" });
      setTransactionForm(emptyTransactionForm);
      await loadInventoryData();
    } catch (err) {
      console.error("Save transaction failed:", err);
      setError(err.response?.data?.message || "Could not record stock movement");
    } finally {
      setSaving(false);
    }
  };

  const lowStockCount = summary.low_stock || 0;
  const expiryAlertCount = summary.expiry_alerts || 0;
  const outOfStockCount = summary.out_of_stock || 0;

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Live Products"
        title="Stock & Suppliers"
        subtitle="Track live product quantity, supplier assignments, low stock, expiry dates, and stock movements."
        actions={
          <>
            <Button variant="outlined" startIcon={<StoreIcon />} onClick={openAddSupplier}>
              Add Supplier
            </Button>
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setHistoryOpen(true)}>
              History
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={loadInventoryData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {lowStockCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {lowStockCount} product{lowStockCount === 1 ? "" : "s"} at or below minimum level.
        </Alert>
      )}

      {expiryAlertCount > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {expiryAlertCount} product{expiryAlertCount === 1 ? "" : "s"} expired or expiring soon.
        </Alert>
      )}

      <StatGrid>
        <StatCard
          label="Products"
          value={summary.total_ingredients || 0}
          helper="Live product stock items"
          icon={<Inventory2Icon />}
          accent="#1976d2"
        />
        <StatCard
          label="Low stock"
          value={summary.low_stock || 0}
          helper="Quantity at or below minimum"
          icon={<ReportProblemIcon />}
          accent="#dc2626"
        />
        <StatCard
          label="Out of stock"
          value={outOfStockCount}
          helper="Products blocked from sale"
          icon={<ReportProblemIcon />}
          accent="#b91c1c"
        />
        <StatCard
          label="Suppliers"
          value={summary.total_suppliers || 0}
          helper="Active vendor contacts"
          icon={<StoreIcon />}
          accent="#059669"
        />
      </StatGrid>

      <SectionCard
        title="Stock Overview"
        subtitle="Live product quantity, minimum level, expiry, supplier, and calculated status."
        actions={
          <>
            <TextField
              size="small"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
              sx={{ minWidth: { xs: "100%", sm: 220 } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="Healthy">Healthy</MenuItem>
                <MenuItem value="Low stock">Low stock</MenuItem>
                <MenuItem value="Expiring soon">Expiring soon</MenuItem>
                <MenuItem value="Expired">Expired</MenuItem>
                <MenuItem value="Out of stock">Out of stock</MenuItem>
              </Select>
            </FormControl>
          </>
        }
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                <TableCell sx={{ fontWeight: 900 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Barcode</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Quantity</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Minimum</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Expiry</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Supplier</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">No live products found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography fontWeight={800}>{item.ingredient_name}</Typography>
                      {item.source_type === "product" && (
                        <Chip size="small" label="Live product" variant="outlined" sx={{ mt: 0.75 }} />
                      )}
                    </TableCell>
                    <TableCell>{item.menu_name || "Uncategorized"}</TableCell>
                    <TableCell>{item.barcode || "-"}</TableCell>
                    <TableCell>
                      {Number(item.quantity).toFixed(2)} {item.unit}
                    </TableCell>
                    <TableCell>
                      {Number(item.minimum_level).toFixed(2)} {item.unit}
                    </TableCell>
                    <TableCell>{formatDisplayDate(item.expiry_date)}</TableCell>
                    <TableCell>{item.supplier_name || "Not assigned"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={item.status}
                        color={getStatusColor(item.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Stock in">
                          <IconButton size="small" onClick={() => openTransactionDialog(item, "STOCK_IN")}>
                            <LoginIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Stock out">
                          <IconButton size="small" onClick={() => openTransactionDialog(item, "STOCK_OUT")}>
                            <LogoutIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEditIngredient(item)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => deleteIngredient(item)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <Dialog open={itemDialog.open} onClose={closeItemDialog} fullWidth maxWidth="sm">
        <DialogTitle>Edit Product Stock</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Product"
              value={itemForm.ingredient_name}
              onChange={(event) => setItemForm((form) => ({ ...form, ingredient_name: event.target.value }))}
              fullWidth
              required
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Quantity"
                type="number"
                value={itemForm.quantity}
                onChange={(event) => setItemForm((form) => ({ ...form, quantity: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Unit"
                value={itemForm.unit}
                onChange={(event) => setItemForm((form) => ({ ...form, unit: event.target.value }))}
                fullWidth
                required
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Minimum level"
                type="number"
                value={itemForm.minimum_level}
                onChange={(event) => setItemForm((form) => ({ ...form, minimum_level: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Cost per unit"
                type="number"
                value={itemForm.cost_per_unit}
                onChange={(event) => setItemForm((form) => ({ ...form, cost_per_unit: event.target.value }))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Expiry date"
              type="date"
              value={itemForm.expiry_date}
              onChange={(event) => setItemForm((form) => ({ ...form, expiry_date: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Barcode"
                value={itemForm.barcode}
                onChange={(event) => setItemForm((form) => ({ ...form, barcode: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Stock used per sale"
                type="number"
                value={itemForm.stock_per_sale}
                onChange={(event) => setItemForm((form) => ({ ...form, stock_per_sale: event.target.value }))}
                fullWidth
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>Supplier</InputLabel>
              <Select
                label="Supplier"
                value={itemForm.supplier_id}
                onChange={(event) => setItemForm((form) => ({ ...form, supplier_id: event.target.value }))}
              >
                <MenuItem value="">Not assigned</MenuItem>
                {suppliers.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeItemDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveIngredient}
            disabled={saving || !itemForm.ingredient_name || !itemForm.unit}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={supplierDialogOpen} onClose={() => setSupplierDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Supplier</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Supplier"
              value={supplierForm.name}
              onChange={(event) => setSupplierForm((form) => ({ ...form, name: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Contact person"
              value={supplierForm.contact_person}
              onChange={(event) => setSupplierForm((form) => ({ ...form, contact_person: event.target.value }))}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Phone"
                value={supplierForm.phone}
                onChange={(event) => setSupplierForm((form) => ({ ...form, phone: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Email"
                value={supplierForm.email}
                onChange={(event) => setSupplierForm((form) => ({ ...form, email: event.target.value }))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Address"
              value={supplierForm.address}
              onChange={(event) => setSupplierForm((form) => ({ ...form, address: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveSupplier} disabled={saving || !supplierForm.name}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={transactionDialog.open}
        onClose={() => setTransactionDialog({ open: false, item: null, type: "STOCK_IN" })}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {transactionDialog.type === "STOCK_IN" ? "Stock In" : "Stock Out"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography fontWeight={800}>
              {transactionDialog.item?.ingredient_name}
            </Typography>
            <TextField
              label="Quantity"
              type="number"
              value={transactionForm.quantity}
              onChange={(event) => setTransactionForm((form) => ({ ...form, quantity: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Notes"
              value={transactionForm.notes}
              onChange={(event) => setTransactionForm((form) => ({ ...form, notes: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransactionDialog({ open: false, item: null, type: "STOCK_IN" })}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveTransaction} disabled={saving || !transactionForm.quantity}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Transaction History</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Quantity</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No transactions found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{transaction.ingredient_name}</TableCell>
                      <TableCell>{transaction.transaction_type.replace("_", " ")}</TableCell>
                      <TableCell>{Number(transaction.quantity).toFixed(2)}</TableCell>
                      <TableCell>{transaction.notes || "-"}</TableCell>
                      <TableCell>{new Date(transaction.created_at).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Inventory;
