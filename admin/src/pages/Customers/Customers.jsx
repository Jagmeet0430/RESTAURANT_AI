import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WalletIcon from "@mui/icons-material/Wallet";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { customersService } from "../../services/customers";
import CustomerProfile from "../../components/customers/CustomerProfile";
import { PageHeader, StatCard, StatGrid } from "../../components/common/PageKit";

const FALLBACK_CUSTOMERS = [
  { id: 1, name: "Rahul Kumar", phone: "+91-9876543210", email: "rahul@example.com", total_orders: 8, total_spent: 5600 },
  { id: 2, name: "Priya Sharma", phone: "+91-9876543211", email: "priya@example.com", total_orders: 5, total_spent: 3200 },
];

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [customerSummary, setCustomerSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response =
        search.trim().length >= 2
          ? await customersService.searchCustomers(search.trim())
          : await customersService.getAllCustomers();

      if (response.success) {
        setCustomers(response.data || []);
        setCustomerSummary(response.summary || null);
        setUsingFallback(false);
      } else {
        setCustomers(FALLBACK_CUSTOMERS);
        setCustomerSummary(null);
        setUsingFallback(true);
        setSnackbar({ open: true, message: response.message || "Showing sample customers", severity: "warning" });
      }
    } catch (error) {
      setCustomers(FALLBACK_CUSTOMERS);
      setCustomerSummary(null);
      setUsingFallback(true);
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || "Backend unavailable. Showing sample customers.",
        severity: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const visibleCustomers = useMemo(() => {
    if (!usingFallback || !search.trim()) return customers;
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      return (
        customer.name?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query)
      );
    });
  }, [customers, search, usingFallback]);

  const stats = useMemo(() => {
    if (!usingFallback && customerSummary) {
      return {
        totalCustomers: Number(customerSummary.total_customers || visibleCustomers.length),
        totalOrders: Number(customerSummary.total_orders || 0),
        totalSpend: Number(customerSummary.total_spent || 0),
        bestCustomer: customerSummary.top_customer || null,
      };
    }

    const totalOrders = visibleCustomers.reduce((sum, customer) => sum + Number(customer.total_orders || 0), 0);
    const totalSpend = visibleCustomers.reduce((sum, customer) => sum + Number(customer.total_spent || 0), 0);
    const bestCustomer = [...visibleCustomers].sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0))[0];
    return { totalCustomers: visibleCustomers.length, totalOrders, totalSpend, bestCustomer };
  }, [customerSummary, usingFallback, visibleCustomers]);

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({ name: customer.name || "", phone: customer.phone || "", email: customer.email || "" });
  };

  const closeEdit = () => {
    setEditingCustomer(null);
    setForm({ name: "", phone: "", email: "" });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setSnackbar({ open: true, message: "Name and phone are required.", severity: "error" });
      return;
    }

    if (usingFallback) {
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === editingCustomer.id
            ? { ...customer, name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null }
            : customer
        )
      );
      closeEdit();
      setSnackbar({ open: true, message: "Customer updated.", severity: "success" });
      return;
    }

    try {
      const response = await customersService.updateCustomer(editingCustomer.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
      });

      if (response.success) {
        setCustomers((prev) => prev.map((customer) => (customer.id === editingCustomer.id ? { ...customer, ...response.data } : customer)));
        closeEdit();
        setSnackbar({ open: true, message: "Customer updated.", severity: "success" });
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to update customer.", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Failed to update customer.",
        severity: "error",
      });
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete ${customer.name}?`)) return;

    if (usingFallback) {
      setCustomers((prev) => prev.filter((item) => item.id !== customer.id));
      setSnackbar({ open: true, message: "Customer deleted.", severity: "success" });
      return;
    }

    try {
      const response = await customersService.deleteCustomer(customer.id);
      if (response.success) {
        setCustomers((prev) => prev.filter((item) => item.id !== customer.id));
        setSnackbar({ open: true, message: "Customer deleted.", severity: "success" });
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to delete customer.", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Failed to delete customer.",
        severity: "error",
      });
    }
  };

  const closeSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Customer CRM"
        title="Customers"
        subtitle="Understand who orders most, how much they spend, and quickly open profiles for service history."
      />

      <StatGrid>
        <StatCard label="Customers" value={stats.totalCustomers} helper={search.trim().length >= 2 ? "Matching records" : "Active records"} icon={<PeopleAltIcon />} accent="#1976d2" />
        <StatCard label="Total orders" value={stats.totalOrders} helper="From actual orders" icon={<WorkspacePremiumIcon />} accent="#059669" />
        <StatCard label="Total spend" value={formatCurrency(stats.totalSpend)} helper="From actual orders" icon={<WalletIcon />} accent="#7c3aed" />
        <StatCard label="Top customer" value={stats.bestCustomer?.name || "-"} helper={stats.bestCustomer ? formatCurrency(stats.bestCustomer.total_spent) : "No data"} icon={<PeopleAltIcon />} accent="#dc6b19" />
      </StatGrid>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: "1px solid #e5e7eb" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search customer name, phone, or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadCustomers();
            }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <Button variant="contained" startIcon={<SearchIcon />} onClick={loadCustomers}>
            Search
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <Table>
          <TableHead>
            <TableRow sx={{ background: "#f5f5f5" }}>
              <TableCell sx={{ fontWeight: "bold" }}>Customer</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Email</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Orders</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Total Spend</TableCell>
              <TableCell sx={{ fontWeight: "bold" }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell>
              </TableRow>
            ) : visibleCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No customers found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleCustomers.map((customer) => (
                <TableRow key={customer.id} hover>
                  <TableCell sx={{ fontWeight: 800 }}>{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.email || "-"}</TableCell>
                  <TableCell>{customer.total_orders || 0}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>{formatCurrency(customer.total_spent)}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="primary" onClick={() => openEdit(customer)} title="Edit"><EditIcon /></IconButton>
                    <IconButton size="small" color="info" onClick={() => { setProfileCustomer(customer); setProfileOpen(true); }} title="View"><VisibilityIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(customer)} title="Delete"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(editingCustomer)} onClose={closeEdit} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Customer</DialogTitle>
        <DialogContent sx={{ paddingTop: 2 }}>
          <TextField fullWidth label="Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} margin="normal" />
          <TextField fullWidth label="Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} margin="normal" />
          <TextField fullWidth label="Email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <CustomerProfile open={profileOpen} onClose={() => setProfileOpen(false)} customer={profileCustomer} />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={closeSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default Customers;
