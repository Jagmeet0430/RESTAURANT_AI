import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import OrderStatusChip from "./OrderStatusChip";

const statuses = ["Confirmed", "Accepted", "Preparing", "Ready", "Out for Delivery", "Completed", "Cancelled"];

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function paymentColor(status) {
  if (status === "Paid") return "success";
  if (status === "Pending") return "warning";
  if (status === "Refunded") return "info";
  return "error";
}

function isPayAtCounterPending(order) {
  return (
    String(order?.payment_method || "").toLowerCase() === "pay at counter" &&
    String(order?.payment_status || "").toLowerCase() !== "paid"
  );
}

function OrderDetails({ open, order, onClose, onStatusUpdate, onMarkPaid, onRetryWhatsApp }) {
  if (!order) return null;

  const handleStatusChange = (newStatus) => {
    if (newStatus === "Cancelled") {
      const reason = window.prompt("Cancellation reason");
      if (!reason) return;
      onStatusUpdate(order.id, newStatus, { cancellationReason: reason });
      onClose();
      return;
    }

    onStatusUpdate(order.id, newStatus);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Order #{order.order_number || order.id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created {formatDate(order.created_at)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <OrderStatusChip status={order.status} />
            <Chip
              label={order.payment_status || "Pending"}
              color={paymentColor(order.payment_status)}
              variant="outlined"
              size="small"
            />
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.4fr 0.9fr" },
            gap: 2,
          }}
        >
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Customer</Typography>
              {order.table_number && (
                <Typography variant="body2">
                  <strong>Table:</strong> {order.table_number}
                </Typography>
              )}
              <Typography variant="body2">
                <strong>Name:</strong> {order.customer_name || "-"}
              </Typography>
              {order.customer_phone && (
                <Typography variant="body2">
                  <strong>Phone:</strong> {order.customer_phone}
                </Typography>
              )}
              {order.delivery_address && (
                <Typography variant="body2">
                  <strong>Address:</strong> {order.delivery_address}
                </Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Ordered Items</Typography>
              {order.items?.length ? (
                order.items.map((item, index) => {
                  const quantity = item.quantity ?? item.qty ?? 1;
                  const total = item.total_price ?? Number(item.unit_price || item.price || 0) * quantity;

                  return (
                    <Box
                      key={`${item.name || item}-${index}`}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        py: 1,
                        borderBottom: index === order.items.length - 1 ? "none" : "1px solid #edf0f3",
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {item.name || item}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Qty {quantity}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>
                        {formatCurrency(total)}
                      </Typography>
                    </Box>
                  );
                })
              ) : (
                <Typography color="text.secondary">No item details available.</Typography>
              )}
            </Paper>

            {order.special_instructions && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "#fffbeb" }}>
                <Typography sx={{ fontWeight: 900, mb: 0.5 }}>Special Instructions</Typography>
                <Typography variant="body2">{order.special_instructions}</Typography>
              </Paper>
            )}
          </Stack>

          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Bill Summary</Typography>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">Subtotal</Typography>
                  <Typography variant="body2">{formatCurrency(order.subtotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">Tax</Typography>
                  <Typography variant="body2">{formatCurrency(order.tax)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">Delivery</Typography>
                  <Typography variant="body2">{formatCurrency(order.delivery_charge)}</Typography>
                </Stack>
                {Number(order.discount || 0) > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Discount</Typography>
                    <Typography variant="body2">-{formatCurrency(order.discount)}</Typography>
                  </Stack>
                )}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontWeight: 900 }}>Total</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{formatCurrency(order.total_amount)}</Typography>
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Payment Check</Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Method:</strong> {order.payment_method || "Cash"}
                </Typography>
                <Typography variant="body2">
                  <strong>Status:</strong> {order.payment_status || "Pending"}
                </Typography>
                <Typography variant="body2">
                  <strong>Phone verified:</strong> {order.phone_verified ? "Yes" : "No"}
                </Typography>
                <Typography variant="body2">
                  <strong>WhatsApp:</strong> {order.whatsapp_status || "Not sent"}
                  {order.whatsapp_error ? ` (${order.whatsapp_error})` : ""}
                </Typography>
                {["failed", "retryable_failed"].includes(order.whatsapp_status) && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onRetryWhatsApp?.(order.id)}
                    sx={{ mt: 1, textTransform: "none", fontWeight: 800 }}
                  >
                    Retry WhatsApp notification
                  </Button>
                )}
                <Typography variant="body2">
                  <strong>Transaction:</strong> {order.transaction_id || "-"}
                </Typography>
                {isPayAtCounterPending(order) && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PaidOutlinedIcon />}
                    onClick={() => onMarkPaid?.(order.id)}
                    sx={{ mt: 1, textTransform: "none", fontWeight: 800 }}
                  >
                    Mark paid after collecting counter payment
                  </Button>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Update Workflow</Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Order Status</InputLabel>
                <Select
                  label="Order Status"
                  defaultValue={order.status || "Pending"}
                  onChange={(event) => handleStatusChange(event.target.value)}
                >
                  {statuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Paper>
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default OrderDetails;
