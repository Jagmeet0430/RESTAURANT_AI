import { Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import OrderStatusChip from "../orders/OrderStatusChip";

const nextStatus = {
  Confirmed: "Accept",
  Accepted: "Start",
  Preparing: "Ready",
  Ready: "Complete",
  "Out for Delivery": "Complete",
};

function formatAge(value) {
  if (!value) return "Just now";

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return "Just now";

  const minutes = Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  return createdAt.toLocaleDateString();
}

function customerLabel(order) {
  if (order.table_number) return `Table ${order.table_number}`;
  return order.customer_name || "Walk-in customer";
}

function KitchenOrderCard({ order, onStatusAdvance }) {
  const items = order.items && order.items.length > 0 ? order.items : [];
  const actionLabel = nextStatus[order.status || "Confirmed"];
  const isReadyAction = order.status === "Preparing";
  const isCompleteAction = order.status === "Ready";

  return (
    <Paper
      sx={{
        borderRadius: 2,
        border: "1px solid #e0e0e0",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
        bgcolor: "#fff",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, color: "#111827" }}>
              #{order.order_number || order.id}
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#6b7280" }}>{customerLabel(order)}</Typography>
          </Box>
          <OrderStatusChip status={order.status || "Confirmed"} />
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "#6b7280" }}>
          <AccessTimeIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 12 }}>{formatAge(order.created_at)}</Typography>
        </Stack>

        <Divider sx={{ my: 1.25 }} />

        <Stack spacing={1} sx={{ minHeight: 96 }}>
          {items.length ? (
            items.map((item, index) => {
              const name = item?.name || item;
              const quantity = item?.quantity ?? item?.qty ?? 1;
              return (
                <Stack
                  key={`${name}-${index}`}
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ color: "#374151" }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{name}</Typography>
                  <Chip size="small" label={`x${quantity}`} sx={{ height: 22, fontWeight: 800 }} />
                </Stack>
              );
            })
          ) : (
            <Typography sx={{ py: 2, color: "#6b7280", fontSize: 13 }}>No item details available.</Typography>
          )}
        </Stack>

        {order.special_instructions && (
          <Box sx={{ mt: 1.25, p: 1, borderRadius: 1, bgcolor: "#fffbeb", border: "1px solid #fde68a" }}>
            <Typography sx={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>
              {order.special_instructions}
            </Typography>
          </Box>
        )}

        {actionLabel && (
          <Button
            fullWidth
            variant="contained"
            color={isReadyAction || isCompleteAction ? "success" : "primary"}
            size="small"
            startIcon={isReadyAction || isCompleteAction ? <CheckCircleIcon /> : undefined}
            endIcon={!isReadyAction && !isCompleteAction ? <ArrowForwardIcon /> : undefined}
            onClick={() => onStatusAdvance(order.id, order.status || "Confirmed")}
            sx={{
              mt: 1.5,
              borderRadius: 1.5,
              fontWeight: 800,
              textTransform: "none",
              py: 0.9,
            }}
          >
            {actionLabel}
          </Button>
        )}
      </Box>
    </Paper>
  );
}

export default KitchenOrderCard;
