import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import VisibilityIcon from "@mui/icons-material/Visibility";
import OrderStatusChip from "./OrderStatusChip";

const lanes = [
  { status: "Confirmed", title: "Confirmed", color: "#f59e0b", bg: "#fffbeb", next: "Accepted" },
  { status: "Accepted", title: "Accepted", color: "#0284c7", bg: "#eff6ff", next: "Preparing" },
  { status: "Preparing", title: "Preparing", color: "#4f46e5", bg: "#eef2ff", next: "Ready" },
  { status: "Ready", title: "Ready", color: "#059669", bg: "#ecfdf5", next: "Completed" },
  { status: "Out for Delivery", title: "Out for delivery", color: "#0f766e", bg: "#f0fdfa", next: "Completed" },
  { status: "Completed", title: "Completed", color: "#16a34a", bg: "#f0fdf4" },
  { status: "Cancelled", title: "Cancelled", color: "#dc2626", bg: "#fef2f2" },
];

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

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

function summarizeItems(order) {
  if (!order.items?.length) {
    const count = Number(order.item_count || 0);
    return `${count} ${count === 1 ? "item" : "items"}`;
  }

  return order.items
    .slice(0, 3)
    .map((item) => `${item.name || item} x${item.quantity ?? item.qty ?? 1}`)
    .join(", ");
}

function paymentColor(status) {
  if (status === "Paid") return "success";
  if (status === "Pending") return "warning";
  if (status === "Refunded") return "info";
  return "error";
}

function customerLabel(order) {
  if (order.table_number) return `Table ${order.table_number}`;
  return order.customer_name || "Walk-in customer";
}

function orderTokenLabel(order) {
  return order.token_number ? `#${order.token_number}` : `#${order.order_number || order.id}`;
}

function isPayAtCounterPending(order) {
  return (
    String(order.payment_method || "").toLowerCase() === "pay at counter" &&
    String(order.payment_status || "").toLowerCase() !== "paid"
  );
}

function OrderCard({ order, lane, onViewDetails, onStatusChange, onMarkPaid }) {
  const needsCounterPayment = isPayAtCounterPending(order);

  return (
    <Paper
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, color: "#111827" }}>
            {orderTokenLabel(order)}
          </Typography>
          {order.token_number && (
            <Typography sx={{ fontSize: 11, color: "#6b7280" }}>{order.order_number}</Typography>
          )}
          <Typography sx={{ fontSize: 13, color: "#6b7280" }}>{customerLabel(order)}</Typography>
        </Box>
        <OrderStatusChip status={order.status} />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25, color: "#6b7280" }}>
        <AccessTimeIcon sx={{ fontSize: 16 }} />
        <Typography sx={{ fontSize: 12 }}>{formatAge(order.created_at)}</Typography>
      </Stack>

      <Tooltip title={summarizeItems(order)}>
        <Typography
          sx={{
            mt: 1,
            minHeight: 38,
            fontSize: 13,
            lineHeight: 1.35,
            color: "#374151",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {summarizeItems(order)}
        </Typography>
      </Tooltip>

      <Divider sx={{ my: 1.25 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ fontWeight: 900 }}>{formatCurrency(order.total_amount)}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          {order.payment_method && (
            <Chip size="small" label={order.payment_method} variant="outlined" />
          )}
          <Chip
            size="small"
            label={needsCounterPayment ? "Collect at counter" : order.payment_status || "Pending"}
            color={paymentColor(order.payment_status)}
            variant="outlined"
          />
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        {needsCounterPayment && (
          <Button
            fullWidth
            size="small"
            variant="contained"
            color="success"
            startIcon={<PaidOutlinedIcon />}
            onClick={() => onMarkPaid?.(order.id)}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            Mark paid
          </Button>
        )}
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<VisibilityIcon />}
          onClick={() => onViewDetails(order)}
          sx={{ textTransform: "none", fontWeight: 800 }}
        >
          Details
        </Button>
        {lane.next && (
          <Button
            fullWidth
            size="small"
            variant={needsCounterPayment ? "outlined" : "contained"}
            endIcon={<ArrowForwardIcon />}
            onClick={() => onStatusChange(order.id, lane.next)}
            disabled={needsCounterPayment}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            {lane.next}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

function OrderBoard({ orders, onViewDetails, onStatusChange, onMarkPaid }) {
  const grouped = lanes.reduce((acc, lane) => {
    acc[lane.status] = [];
    return acc;
  }, {});

  orders.forEach((order) => {
  const status = order.status || "Confirmed";
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(order);
  });

  if (!orders.length) {
    return (
      <Paper
        sx={{
          border: "1px dashed #d7dce3",
          borderRadius: 2,
          py: 6,
          textAlign: "center",
        }}
      >
        <ReceiptLongIcon sx={{ fontSize: 40, color: "#9ca3af", mb: 1 }} />
        <Typography variant="h6">No orders found</Typography>
        <Typography color="text.secondary">Try changing the filters or refreshing the page.</Typography>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(3, minmax(0, 1fr))",
        },
        gap: 2,
      }}
    >
      {lanes.map((lane) => {
        const laneOrders = grouped[lane.status] || [];

        return (
          <Box
            key={lane.status}
            sx={{
              border: "1px solid #e5e7eb",
              borderRadius: 2,
              bgcolor: lane.bg,
              p: 1.5,
              minHeight: 180,
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
                  <OrderCard
                    key={order.id}
                    order={order}
                    lane={lane}
                    onViewDetails={onViewDetails}
                    onStatusChange={onStatusChange}
                    onMarkPaid={onMarkPaid}
                  />
                ))
              ) : (
                <Typography sx={{ py: 3, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                  No orders here
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

export default OrderBoard;
