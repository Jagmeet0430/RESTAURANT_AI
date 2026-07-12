import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import OrderStatusChip from "./OrderStatusChip";

const statuses = ["Pending", "Accepted", "Preparing", "Ready", "Completed", "Cancelled"];

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function formatCreatedAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function getPaymentColor(status) {
  if (status === "Paid") return "success";
  if (status === "Pending") return "warning";
  if (status === "Refunded") return "info";
  return "error";
}

function customerLabel(order) {
  if (order.table_number) return `Table ${order.table_number}`;
  return order.customer_name || "Walk-in customer";
}

function OrdersTable({ orders, onViewDetails, onStatusChange, loading }) {
  return (
    <TableContainer component={Paper} sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <Table>
        <TableHead>
          <TableRow sx={{ background: "#f5f5f5" }}>
            <TableCell sx={{ fontWeight: "bold" }}>Order</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Customer</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Items</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Amount</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Payment</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Time</TableCell>
            <TableCell sx={{ fontWeight: "bold" }} align="center">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                <CircularProgress />
              </TableCell>
            </TableRow>
          ) : orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                <Typography color="text.secondary">No orders found.</Typography>
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 900 }}>#{order.order_number || order.id}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#6b7280" }}>ID {order.id}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {customerLabel(order)}
                  </Typography>
                  {order.customer_phone && (
                    <Typography variant="caption" color="text.secondary">
                      {order.customer_phone}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ fontSize: 12, maxWidth: 260 }}>
                    {order.items && order.items.length > 0
                      ? order.items.slice(0, 3).map((item, index) => (
                          <div key={`${item.name || item}-${index}`}>
                            {item.name || item} x{item.quantity ?? item.qty ?? 1}
                          </div>
                        ))
                      : `${order.item_count || 0} item${Number(order.item_count) === 1 ? "" : "s"}`}
                    {order.items?.length > 3 && (
                      <Typography variant="caption" color="text.secondary">
                        +{order.items.length - 3} more
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 900 }}>{formatCurrency(order.total_amount)}</TableCell>
                <TableCell>
                  <Chip
                    label={order.payment_status || "Pending"}
                    color={getPaymentColor(order.payment_status)}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <OrderStatusChip status={order.status} />
                    <Select
                      value={order.status || "Pending"}
                      size="small"
                      onChange={(event) => onStatusChange(order.id, event.target.value)}
                      sx={{ minWidth: 122, ".MuiSelect-select": { py: 0.7, fontSize: 13 } }}
                    >
                      {statuses.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </Select>
                  </Stack>
                </TableCell>
                <TableCell>{formatCreatedAt(order.created_at)}</TableCell>
                <TableCell align="center">
                  <IconButton size="small" color="primary" onClick={() => onViewDetails(order)} title="View details">
                    <VisibilityIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default OrdersTable;
