import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DailySalesChart from "../../components/charts/DailySalesChart";
import WeeklySalesChart from "../../components/charts/WeeklySalesChart";
import MonthlySalesChart from "../../components/charts/MonthlySalesChart";
import PredictionVsActual from "../../components/charts/PredictionVsActual";
import RevenueTrend from "../../components/charts/RevenueTrend";
import { PageHeader } from "../../components/common/PageKit";
import { getSalesReport } from "../../services/reports";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatChange(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : ""}${amount.toFixed(1)}%`;
}

function changeColor(value, fallback = "primary") {
  return Number(value || 0) < 0 ? "error" : fallback;
}

function formatHour(hour) {
  const date = new Date();
  date.setHours(Number(hour || 0), 0, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Analytics() {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      setSummaryError("");
      const response = await getSalesReport();
      setSummary(response?.success ? response.data?.summary || null : null);
    } catch (error) {
      setSummaryError(error?.response?.data?.message || "Failed to load analytics summary.");
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    const intervalId = window.setInterval(loadSummary, 60000);
    return () => window.clearInterval(intervalId);
  }, [loadSummary]);

  const summaryCards = useMemo(
    () => [
      {
        title: "Revenue",
        value: summary ? formatCurrency(summary.revenue) : "-",
        change: formatChange(summary?.changes?.revenue),
        icon: <TrendingUpIcon />,
        color: changeColor(summary?.changes?.revenue, "primary"),
      },
      {
        title: "Orders",
        value: summary ? formatNumber(summary.orders) : "-",
        change: formatChange(summary?.changes?.orders),
        icon: <ReceiptLongIcon />,
        color: changeColor(summary?.changes?.orders, "secondary"),
      },
      {
        title: "Customers",
        value: summary ? formatNumber(summary.customers) : "-",
        change: formatChange(summary?.changes?.customers),
        icon: <PeopleAltIcon />,
        color: changeColor(summary?.changes?.customers, "success"),
      },
    ],
    [summary]
  );

  const peakHours = summary?.peak_hours || [];

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Performance"
        title="Analytics"
        subtitle="Understand sales, order volume, peak hours, revenue trends, and prediction accuracy from one place."
      />

      {summaryError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {summaryError}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid size={{ xs: 12, md: 4 }} key={card.title}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6">{card.title}</Typography>
                  <Box sx={{ color: `${card.color}.main` }}>{card.icon}</Box>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700, minHeight: 44 }}>
                  {loadingSummary ? <CircularProgress size={28} /> : card.value}
                </Typography>
                <Chip
                  label={loadingSummary ? "Loading" : card.change}
                  color={card.color}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper sx={{ p: 3, height: "100%" }}>
            <DailySalesChart />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper sx={{ p: 3, height: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <AccessTimeIcon color="secondary" />
              <Typography variant="h6">Peak Hours</Typography>
            </Stack>
            <Stack spacing={1.5}>
              {peakHours.length > 0 ? (
                peakHours.map((hour) => (
                  <Box key={hour.hour} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography>{formatHour(hour.hour)}</Typography>
                    <Typography fontWeight={600}>{hour.orders} orders</Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">No order activity yet.</Typography>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper sx={{ p: 3 }}>
            <WeeklySalesChart />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper sx={{ p: 3 }}>
            <MonthlySalesChart />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper sx={{ p: 3 }}>
            <PredictionVsActual />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper sx={{ p: 3 }}>
            <RevenueTrend />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Analytics;
