import React from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import DailySalesChart from "../../components/charts/DailySalesChart";
import WeeklySalesChart from "../../components/charts/WeeklySalesChart";
import MonthlySalesChart from "../../components/charts/MonthlySalesChart";
import PredictionVsActual from "../../components/charts/PredictionVsActual";
import RevenueTrend from "../../components/charts/RevenueTrend";
import { PageHeader } from "../../components/common/PageKit";

const summaryCards = [
  { title: "Revenue", value: "Rs. 1,24,500", change: "+12.4%", icon: <TrendingUpIcon />, color: "primary" },
  { title: "Orders", value: "1,248", change: "+8.1%", icon: <ReceiptLongIcon />, color: "secondary" },
  { title: "Customers", value: "342", change: "+5.3%", icon: <PeopleAltIcon />, color: "success" },
];

const peakHours = [
  { time: "12:00 PM", orders: 48 },
  { time: "1:00 PM", orders: 64 },
  { time: "8:00 PM", orders: 92 },
  { time: "9:00 PM", orders: 76 },
];

const topFoods = [
  { name: "Paneer Butter Masala", orders: 128 },
  { name: "Chicken Biryani", orders: 96 },
  { name: "Veg Pizza", orders: 84 },
  { name: "French Fries", orders: 67 },
];

function Analytics() {
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Performance"
        title="Analytics"
        subtitle="Understand sales, order volume, peak hours, revenue trends, and prediction accuracy from one place."
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid size={{ xs: 12, md: 4 }} key={card.title}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6">{card.title}</Typography>
                  <Box sx={{ color: `${card.color}.main` }}>{card.icon}</Box>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {card.value}
                </Typography>
                <Chip label={card.change} color={card.color} size="small" sx={{ mt: 1 }} />
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
              {peakHours.map((hour) => (
                <Box key={hour.time} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography>{hour.time}</Typography>
                  <Typography fontWeight={600}>{hour.orders} orders</Typography>
                </Box>
              ))}
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
