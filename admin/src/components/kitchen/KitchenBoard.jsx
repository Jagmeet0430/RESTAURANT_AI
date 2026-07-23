import { Box, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import KitchenOrderCard from "./KitchenOrderCard";

const lanes = [
  { status: "Confirmed", title: "Confirmed", color: "#f59e0b", bg: "#fffbeb" },
  { status: "Accepted", title: "Accepted", color: "#0284c7", bg: "#eff6ff" },
  { status: "Preparing", title: "Preparing", color: "#4f46e5", bg: "#eef2ff" },
  { status: "Ready", title: "Ready", color: "#059669", bg: "#ecfdf5" },
  { status: "Out for Delivery", title: "Delivery", color: "#0f766e", bg: "#f0fdfa" },
];

function KitchenBoard({ orders, onStatusAdvance, loading }) {
  if (loading && orders.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (orders.length === 0) {
    return (
      <Box
        sx={{
          border: "1px solid #e0e0e0",
          borderRadius: 2,
          background: "#fff",
          py: 8,
          textAlign: "center",
        }}
      >
        <Typography color="textSecondary">No kitchen orders.</Typography>
      </Box>
    );
  }

  const grouped = lanes.reduce((acc, lane) => {
    acc[lane.status] = [];
    return acc;
  }, {});

  orders.forEach((order) => {
    const status = order.status || "Confirmed";
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(order);
  });

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(4, minmax(0, 1fr))",
        },
        gap: 2,
      }}
    >
      {lanes.map((lane) => {
        const laneOrders = grouped[lane.status] || [];

        return (
          <Paper
            key={lane.status}
            sx={{
              border: "1px solid #e5e7eb",
              borderRadius: 2,
              bgcolor: lane.bg,
              p: 1.5,
              minHeight: 220,
              boxShadow: "none",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: lane.color }} />
                <Typography sx={{ fontWeight: 900 }}>{lane.title}</Typography>
              </Stack>
              <Chip size="small" label={laneOrders.length} sx={{ fontWeight: 800, bgcolor: "#fff" }} />
            </Stack>

            <Stack spacing={1.25}>
              {laneOrders.length ? (
                laneOrders.map((order) => (
                  <KitchenOrderCard key={order.id} order={order} onStatusAdvance={onStatusAdvance} />
                ))
              ) : (
                <Typography sx={{ py: 3, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                  No orders here
                </Typography>
              )}
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}

export default KitchenBoard;
