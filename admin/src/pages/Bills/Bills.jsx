import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Divider,
  FormControl,
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
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import LocalPrintshopIcon from "@mui/icons-material/LocalPrintshop";
import PaymentsIcon from "@mui/icons-material/Payments";
import RefreshIcon from "@mui/icons-material/Refresh";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";

import { PageHeader, SectionCard, StatCard, StatGrid } from "../../components/common/PageKit";
import { billsService } from "../../services/bills";
import { settingsService } from "../../services/settings";

const paymentMethods = ["Cash", "UPI", "Card", "Pay at Counter"];

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusColor(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "success";
  if (normalized === "failed" || normalized === "refunded") return "error";
  return "warning";
}

function sourceLabel(source) {
  return source === "counter_sale" ? "POS" : "Order";
}

function Bills() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [tableDues, setTableDues] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({
    range: "today",
    status: "",
    method: "",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ severity: "info", text: "" });
  const [payDialog, setPayDialog] = useState(null);
  const [settleDialog, setSettleDialog] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const [receiptSettings, setReceiptSettings] = useState({
    autoOpenReceiptAfterPayment: "false",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setMessage({ severity: "info", text: "" });
      const [billsResponse, tablesResponse, summaryResponse, settingsResponse] = await Promise.all([
        billsService.getBills({ ...filters, limit: 150 }),
        billsService.getTableDues(),
        billsService.getEndOfDay(),
        settingsService.getSettings().catch(() => ({ data: {} })),
      ]);
      setBills(billsResponse.data || []);
      setTableDues(tablesResponse.data || []);
      setSummary(summaryResponse.data || null);
      setReceiptSettings({
        autoOpenReceiptAfterPayment: settingsResponse.data?.autoOpenReceiptAfterPayment || "false",
      });
    } catch (error) {
      setMessage({
        severity: "error",
        text: error.response?.data?.message || error.message || "Unable to load bills.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.range, filters.status, filters.method]);

  const filteredSearch = () => {
    loadData();
  };

  const visibleTotals = useMemo(() => {
    const paid = bills
      .filter((bill) => String(bill.payment_status || "").toLowerCase() === "paid")
      .reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);
    const unpaid = bills
      .filter((bill) => String(bill.payment_status || "").toLowerCase() !== "paid")
      .reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);
    return { paid, unpaid };
  }, [bills]);

  const openReceipt = (bill, autoPrint = false) => {
    const suffix = autoPrint ? "?print=1" : "";
    navigate(`/receipt/${bill.source_type}/${bill.source_id}${suffix}`);
  };

  const shouldAutoOpenReceipt = () =>
    String(receiptSettings.autoOpenReceiptAfterPayment || "").toLowerCase() === "true";

  const confirmPayOrder = async () => {
    if (!payDialog) return;
    try {
      setSaving(true);
      const response = await billsService.payOrder(payDialog.source_id, {
        payment_method: paymentMethod,
        expected_total: payDialog.total_amount,
      });
      const paidBill = response.data?.bill;
      setPayDialog(null);
      await loadData();
      if (paidBill?.order_id) {
        if (shouldAutoOpenReceipt()) {
          navigate(`/receipt/order/${paidBill.order_id}?print=1`);
        } else {
          setMessage({
            severity: "success",
            text: `${payDialog.order_number} was marked paid. Use Print or Reprint when the receipt is needed.`,
          });
        }
      }
    } catch (error) {
      setMessage({
        severity: "error",
        text: error.response?.data?.message || error.message || "Unable to mark this order paid.",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmSettleTable = async () => {
    if (!settleDialog) return;
    try {
      setSaving(true);
      const response = await billsService.settleTable(settleDialog.table_id, {
        payment_method: paymentMethod,
        expected_total: settleDialog.total_due,
      });
      setSettleDialog(null);
      await loadData();
      const firstOrder = response.data?.orders?.[0];
      if (firstOrder?.id) {
        if (shouldAutoOpenReceipt()) {
          navigate(`/receipt/order/${firstOrder.id}?print=1`);
        } else {
          setMessage({
            severity: "success",
            text: `Table ${settleDialog.table_number} was settled. Use Reprint for receipts.`,
          });
        }
      }
    } catch (error) {
      setMessage({
        severity: "error",
        text: error.response?.data?.message || error.message || "Unable to settle this table.",
      });
    } finally {
      setSaving(false);
    }
  };

  const openPayDialog = (bill) => {
    setPaymentMethod("Cash");
    setPayDialog(bill);
  };

  const openSettleDialog = (table) => {
    setPaymentMethod("Cash");
    setSettleDialog(table);
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Billing"
        title="Bills / Payments"
        subtitle="Settle unpaid orders, print receipts, and review today's payment collection."
        actions={
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {message.text && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <StatGrid>
        <StatCard
          label="Collected today"
          value={formatCurrency(summary?.total_collected)}
          helper={`Cash ${formatCurrency(summary?.cash_sales)} | UPI ${formatCurrency(summary?.upi_sales)} | Card ${formatCurrency(summary?.card_sales)}`}
          icon={<PaymentsIcon />}
          accent="#059669"
        />
        <StatCard
          label="Unpaid today"
          value={formatCurrency(summary?.unpaid_total)}
          helper={`${summary?.unpaid_orders || 0} unpaid order${Number(summary?.unpaid_orders || 0) === 1 ? "" : "s"}`}
          icon={<AccountBalanceWalletIcon />}
          accent="#dc6b19"
        />
        <StatCard
          label="Visible paid"
          value={formatCurrency(visibleTotals.paid)}
          helper={`${bills.length} bill${bills.length === 1 ? "" : "s"} in current view`}
          icon={<LocalPrintshopIcon />}
          accent="#1976d2"
        />
        <StatCard
          label="Table dues"
          value={formatCurrency(tableDues.reduce((sum, table) => sum + Number(table.total_due || 0), 0))}
          helper={`${tableDues.length} table${tableDues.length === 1 ? "" : "s"} waiting`}
          icon={<TableRestaurantIcon />}
          accent="#7c3aed"
        />
      </StatGrid>

      <SectionCard title="Filters" sx={{ mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Date</InputLabel>
            <Select
              label="Date"
              value={filters.range}
              onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="">All</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Paid">Paid</MenuItem>
              <MenuItem value="Pending">Unpaid</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Method</InputLabel>
            <Select
              label="Method"
              value={filters.method}
              onChange={(event) => setFilters((current) => ({ ...current, method: event.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="upi">UPI</MenuItem>
              <MenuItem value="card">Card</MenuItem>
              <MenuItem value="counter">Pay at Counter</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Order or bill number"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") filteredSearch();
            }}
            fullWidth
          />
          <Button variant="contained" onClick={filteredSearch}>
            Search
          </Button>
        </Stack>
      </SectionCard>

      {tableDues.length > 0 && (
        <SectionCard title="Table Settlement" sx={{ mb: 2 }}>
          <Stack spacing={1}>
            {tableDues.map((table) => (
              <Stack
                key={table.table_id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                sx={{ borderBottom: "1px solid #e5e7eb", pb: 1 }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 900 }}>Table {table.table_number}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {table.active_orders} unpaid order{table.active_orders === 1 ? "" : "s"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 900 }}>{formatCurrency(table.total_due)}</Typography>
                  <Button variant="contained" onClick={() => openSettleDialog(table)}>
                    Settle Table
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      )}

      <SectionCard title="Bills">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                <TableCell sx={{ fontWeight: 900 }}>Bill</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Reference</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Customer / Table</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Method</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">No bills found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((bill) => {
                  const isPaid = String(bill.payment_status || "").toLowerCase() === "paid";
                  return (
                    <TableRow key={`${bill.source_type}-${bill.source_id}`} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 900 }}>{bill.bill_number}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {sourceLabel(bill.source_type)}
                        </Typography>
                      </TableCell>
                      <TableCell>{bill.order_number || "-"}</TableCell>
                      <TableCell>
                        <Typography>{bill.customer_name || "Walk-in Customer"}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {bill.table_number ? `Table ${bill.table_number}` : bill.customer_phone || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>{bill.payment_method || "-"}</TableCell>
                      <TableCell>
                        <Chip size="small" color={statusColor(bill.payment_status)} label={isPaid ? "Paid" : "Unpaid"} />
                      </TableCell>
                      <TableCell align="right">{formatCurrency(bill.total_amount)}</TableCell>
                      <TableCell>{formatDateTime(bill.created_at)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {!isPaid && bill.source_type === "order" && (
                            <Button size="small" variant="contained" onClick={() => openPayDialog(bill)}>
                              Pay Order
                            </Button>
                          )}
                          <Tooltip title={isPaid ? "Reprint receipt" : "Print bill"}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<LocalPrintshopIcon />}
                              onClick={() => openReceipt(bill)}
                            >
                              {isPaid ? "Reprint" : "Print"}
                            </Button>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <Dialog open={Boolean(payDialog)} onClose={() => setPayDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent>
          {payDialog && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info">
                Confirm collection of {formatCurrency(payDialog.total_amount)} for {payDialog.order_number}.
              </Alert>
              <FormControl fullWidth>
                <InputLabel>Payment method</InputLabel>
                <Select
                  label="Payment method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  {paymentMethods.map((method) => (
                    <MenuItem key={method} value={method}>{method}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={confirmPayOrder} disabled={saving}>
            {saving ? "Marking Paid..." : "Mark Paid"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(settleDialog)} onClose={() => setSettleDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Settle Table</DialogTitle>
        <DialogContent>
          {settleDialog && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info">
                Confirm collection of {formatCurrency(settleDialog.total_due)} for Table {settleDialog.table_number}.
              </Alert>
              <Box>
                {(settleDialog.orders || []).map((order) => (
                  <Stack key={order.id} direction="row" justifyContent="space-between" sx={{ py: 0.75 }}>
                    <Typography>{order.order_number}</Typography>
                    <Typography sx={{ fontWeight: 900 }}>{formatCurrency(order.total_amount)}</Typography>
                  </Stack>
                ))}
              </Box>
              <Divider />
              <FormControl fullWidth>
                <InputLabel>Payment method</InputLabel>
                <Select
                  label="Payment method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  {paymentMethods.map((method) => (
                    <MenuItem key={method} value={method}>{method}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettleDialog(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={confirmSettleTable} disabled={saving}>
            {saving ? "Settling..." : "Settle Table"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Bills;
