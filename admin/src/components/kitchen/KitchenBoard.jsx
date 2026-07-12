import { Box, CircularProgress, Grid, Typography } from "@mui/material";
import KitchenOrderCard from "./KitchenOrderCard";

function KitchenBoard({ orders, onMarkReady, loading }) {
  const visibleOrders = orders.filter((order) => ["Pending", "Accepted", "Preparing"].includes(order.status));

  if (loading && visibleOrders.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (visibleOrders.length === 0) {
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

  return (
    <Grid container spacing={2}>
      {visibleOrders.map((order) => (
        <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={order.id}>
          <KitchenOrderCard order={order} onMarkReady={onMarkReady} />
        </Grid>
      ))}
    </Grid>
  );
}

export default KitchenBoard;
