import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
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
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import HistoryIcon from "@mui/icons-material/History";
import PaymentsIcon from "@mui/icons-material/Payments";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";

import { PageHeader, SectionCard, StatCard, StatGrid } from "../../components/common/PageKit";
import { billsService } from "../../services/bills";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function EndOfDay() {
  const [businessDate, setBusinessDate] = useState(todayIso);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [actualCash, setActualCash] = useState("");
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState({ severity: "info", text: "" });

  const cashDifference = useMemo(() => {
    if (actualCash === "") return 0;
    return Number((Number(actualCash || 0) - Number(summary?.expected_cash || 0)).toFixed(2));
  }, [actualCash, summary]);

  const loadData = async () => {
    try {
      setLoading(true);
      setMessage({ severity: "info", text: "" });
      const [summaryResponse, historyResponse] = await Promise.all([
        billsService.getEndOfDayForDate(businessDate),
        billsService.getSettlementHistory(30),
      ]);
      const nextSummary = summaryResponse.data || null;
      setSummary(nextSummary);
      setActualCash((current) => (current === "" ? String(nextSummary?.expected_cash ?? "") : current));
      setHistory(historyResponse.data || []);
    } catch (error) {
      setMessage({
        severity: "error",
        text: error.response?.data?.message || error.message || "Unable to load end-of-day summary.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActualCash("");
    loadData();
  }, [businessDate]);

  const closeDay = async () => {
    const confirmed = window.confirm(`Close day for ${businessDate}? This stores a settlement snapshot.`);
    if (!confirmed) return;

    try {
      setClosing(true);
      const response = await billsService.closeEndOfDay({
        business_date: businessDate,
        actual_cash: Number(actualCash || 0),
      });
      setMessage({
        severity: response.data?.alreadyClosed ? "info" : "success",
        text: response.message || "End-of-day settlement saved.",
      });
      await loadData();
    } catch (error) {
      setMessage({
        severity: "error",
        text: error.response?.data?.message || error.message || "Unable to close the day.",
      });
    } finally {
      setClosing(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Settlement"
        title="End of Day"
        subtitle="Review payment collections, compare expected cash with drawer cash, and store a daily close snapshot."
        actions={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              type="date"
              size="small"
              label="Business date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value || todayIso())}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" onClick={loadData} disabled={loading}>
              Refresh
            </Button>
          </Stack>
        }
      />

      {message.text && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <StatGrid>
            <StatCard
              label="Cash collected"
              value={formatCurrency(summary?.cash_collected)}
              helper="Expected drawer cash from paid sales"
              icon={<AccountBalanceWalletIcon />}
              accent="#059669"
            />
            <StatCard
              label="UPI collected"
              value={formatCurrency(summary?.upi_collected)}
              helper="Manual offline UPI entries"
              icon={<PaymentsIcon />}
              accent="#1976d2"
            />
            <StatCard
              label="Card collected"
              value={formatCurrency(summary?.card_collected)}
              helper="Manual offline card entries"
              icon={<PaymentsIcon />}
              accent="#7c3aed"
            />
            <StatCard
              label="Total paid"
              value={formatCurrency(summary?.total_paid)}
              helper={`Unpaid ${formatCurrency(summary?.unpaid_amount)}`}
              icon={<PointOfSaleIcon />}
              accent="#dc6b19"
            />
          </StatGrid>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.9fr) minmax(0, 1.1fr)" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <SectionCard title="Cash Drawer">
              <Stack spacing={2}>
                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Expected Cash</Typography>
                    <Typography sx={{ fontWeight: 900 }}>{formatCurrency(summary?.expected_cash)}</Typography>
                  </Stack>
                  <TextField
                    label="Actual Cash"
                    type="number"
                    value={actualCash}
                    onChange={(event) => setActualCash(event.target.value)}
                    fullWidth
                  />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Difference</Typography>
                    <Typography sx={{ fontWeight: 900 }} color={cashDifference < 0 ? "error.main" : "success.main"}>
                      {formatCurrency(cashDifference)}
                    </Typography>
                  </Stack>
                </Stack>
                <Divider />
                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">POS revenue</Typography>
                    <Typography sx={{ fontWeight: 900 }}>{formatCurrency(summary?.pos_revenue)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Restaurant-order revenue</Typography>
                    <Typography sx={{ fontWeight: 900 }}>{formatCurrency(summary?.restaurant_order_revenue)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Combined total</Typography>
                    <Typography sx={{ fontWeight: 900 }}>{formatCurrency(summary?.combined_total)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">Refunds</Typography>
                    <Typography sx={{ fontWeight: 900 }}>{formatCurrency(summary?.refunds)}</Typography>
                  </Stack>
                </Stack>
                <Button variant="contained" size="large" onClick={closeDay} disabled={closing}>
                  {closing ? "Closing..." : "Close Day"}
                </Button>
              </Stack>
            </SectionCard>

            <SectionCard
              title="Settlement History"
              actions={<HistoryIcon color="action" />}
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>Closed</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>Paid</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>Cash Diff</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                          <Typography color="text.secondary">No day has been closed yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((settlement) => (
                        <TableRow key={settlement.id} hover>
                          <TableCell>{formatDate(settlement.business_date)}</TableCell>
                          <TableCell>{formatDateTime(settlement.closed_at)}</TableCell>
                          <TableCell align="right">{formatCurrency(settlement.total_paid)}</TableCell>
                          <TableCell align="right">{formatCurrency(settlement.cash_difference)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionCard>
          </Box>
        </>
      )}
    </Box>
  );
}

export default EndOfDay;
