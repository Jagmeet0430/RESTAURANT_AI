import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import SavingsIcon from "@mui/icons-material/Savings";
import reportsService from "../../services/reports";
import { PageHeader } from "../../components/common/PageKit";

const reportCards = [
  { key: "dailySales", title: "Daily Sales", icon: <BarChartIcon />, color: "primary" },
  { key: "weeklySales", title: "Weekly Sales", icon: <TrendingUpIcon />, color: "secondary" },
  { key: "monthlySales", title: "Monthly Sales", icon: <BarChartIcon />, color: "success" },
  { key: "topSellingFood", title: "Top Selling Food", icon: <RestaurantIcon />, color: "warning" },
  { key: "revenue", title: "Revenue", icon: <AttachMoneyIcon />, color: "info" },
  { key: "profit", title: "Profit", icon: <SavingsIcon />, color: "error" },
];

const reportPreview = {
  dailySales: "Today's sales summary and transaction count",
  weeklySales: "This week's performance across all orders",
  monthlySales: "Month-to-date revenue and order volume",
  topSellingFood: "Most ordered dish for the current period",
  revenue: "Gross revenue from completed sales",
  profit: "Estimated profit after operating costs",
};

function Reports() {
  const [selectedReport, setSelectedReport] = useState("dailySales");
  const [generated, setGenerated] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingAllSales, setExportingAllSales] = useState(false);
  const [exportError, setExportError] = useState("");

  const activeReport = useMemo(() => {
    return reportCards.find((item) => item.key === selectedReport) || reportCards[0];
  }, [selectedReport]);

  const handleGenerate = () => {
    setGenerated(true);
  };

  const handleExportAllReports = async () => {
    try {
      setExportError("");
      setExportingAll(true);
      await reportsService.exportAllReports();
    } catch (error) {
      setExportError(error?.response?.data?.message || "Failed to generate all reports PDF.");
    } finally {
      setExportingAll(false);
    }
  };

  const handleExportAllSales = async () => {
    try {
      setExportError("");
      setExportingAllSales(true);
      await reportsService.exportAllSales();
    } catch (error) {
      setExportError(error?.response?.data?.message || "Failed to generate all sales PDF.");
    } finally {
      setExportingAllSales(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Business Reports"
        title="Reports"
        subtitle="Generate simple snapshots for sales, inventory, customers, revenue, and profit."
        actions={
          <Stack spacing={1} alignItems="stretch">
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="contained" onClick={handleGenerate}>
                Generate
              </Button>
              <Button variant="outlined" onClick={() => reportsService.exportSales('pdf')}>
                Export Sales (PDF)
              </Button>
              <Button variant="outlined" onClick={() => reportsService.exportSales('excel')}>
                Export Sales (Excel)
              </Button>
              <Button variant="outlined" onClick={() => reportsService.exportInventory('excel')}>
                Export Inventory (Excel)
              </Button>
              <Button variant="outlined" onClick={() => reportsService.exportCustomers('excel')}>
                Export Customers (Excel)
              </Button>
            </Stack>
            <Button variant="contained" color="success" onClick={handleExportAllReports} disabled={exportingAll}>
              {exportingAll ? "Generating All Reports..." : "Generate All Reports (PDF)"}
            </Button>
          </Stack>
        }
      />

      {exportError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {exportError}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {reportCards.map((report) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={report.key}>
            <Card
              variant="outlined"
              sx={{
                cursor: "pointer",
                borderColor: selectedReport === report.key ? "primary.main" : "divider",
                boxShadow: selectedReport === report.key ? 3 : 0,
                height: "100%",
              }}
              onClick={() => setSelectedReport(report.key)}
            >
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                  <Box sx={{ color: `${report.color}.main` }}>{report.icon}</Box>
                  <Typography variant="h6">{report.title}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {reportPreview[report.key]}
                </Typography>
                {report.key === "revenue" && (
                  <Button
                    variant="contained"
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleExportAllSales();
                    }}
                    disabled={exportingAllSales}
                  >
                    {exportingAllSales ? "Generating..." : "Generate All Sales"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={2}>
          <Box>
            <Typography variant="h5">{activeReport.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {reportPreview[activeReport.key]}
            </Typography>
          </Box>
          <Chip label={generated ? "Generated" : "Ready to generate"} color={generated ? "success" : "default"} />
        </Stack>

        {activeReport.key === "revenue" && (
          <Button
            variant="contained"
            sx={{ mb: 2 }}
            onClick={handleExportAllSales}
            disabled={exportingAllSales}
          >
            {exportingAllSales ? "Generating All Sales PDF..." : "Generate All Sales (PDF)"}
          </Button>
        )}

        {generated ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            {activeReport.title} report generated successfully.
          </Alert>
        ) : (
          <Alert severity="info">
            Select a report card and press Generate to view your report summary.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default Reports;
