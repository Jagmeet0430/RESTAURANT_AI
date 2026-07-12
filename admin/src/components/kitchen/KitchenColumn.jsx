import { Box, Paper, Typography, Chip } from "@mui/material";
import KitchenOrderCard from "./KitchenOrderCard";

function KitchenColumn({ title, icon, orders, onMoveNext, columnIndex, totalColumns }) {
  const isLastColumn = columnIndex === totalColumns - 1;

  return (
    <Paper
      sx={{
        padding: 2,
        background: "#f9f9f9",
        minHeight: "600px",
        borderRadius: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      {/* Column Header */}
      <Box sx={{ marginBottom: 2, textAlign: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, marginBottom: 1 }}>
          <span style={{ fontSize: "24px" }}>{icon}</span>
          <Typography variant="h6" sx={{ fontWeight: "bold", margin: 0 }}>
            {title}
          </Typography>
        </Box>
        <Chip
          label={`${orders.length} order${orders.length !== 1 ? "s" : ""}`}
          color={orders.length > 0 ? "primary" : "default"}
          variant="outlined"
          size="small"
        />
      </Box>

      {/* Orders in Column */}
      <Box>
        {orders.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "400px",
              color: "#999",
              fontSize: "14px",
            }}
          >
            No orders
          </Box>
        ) : (
          orders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              onMoveNext={onMoveNext}
              isLastColumn={isLastColumn}
            />
          ))
        )}
      </Box>
    </Paper>
  );
}

export default KitchenColumn;
