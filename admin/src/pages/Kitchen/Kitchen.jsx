import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Snackbar } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import RoomServiceIcon from "@mui/icons-material/RoomService";
import KitchenBoard from "../../components/kitchen/KitchenBoard";
import { kitchenService } from "../../services/order";
import { PageHeader, StatCard, StatGrid } from "../../components/common/PageKit";

const PHASE_8_FALLBACK_ORDERS = [
  {
    id: 101,
    order_number: "ORD-101",
    status: "Preparing",
    customer_name: "Table 5",
    items: [
      { name: "Paneer Tikka Pizza", quantity: 2 },
      { name: "Veggie Noodles", quantity: 1 },
    ],
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
  },
];

const nextKitchenStatus = {
  Confirmed: "Accepted",
  Accepted: "Preparing",
  Preparing: "Ready",
  Ready: "Completed",
  "Out for Delivery": "Completed",
};

const kitchenStatuses = new Set(Object.keys(nextKitchenStatus));

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const fetchKitchenOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await kitchenService.getActiveOrders();
      if (response.success) {
        setOrders(response.data || []);
        setUsingFallback(false);
      } else {
        setOrders(PHASE_8_FALLBACK_ORDERS);
        setUsingFallback(true);
        setSnackbar({ open: true, message: response.message || "Showing sample kitchen order", severity: "warning" });
      }
    } catch (error) {
      setOrders(PHASE_8_FALLBACK_ORDERS);
      setUsingFallback(true);
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || "Backend unavailable. Showing sample kitchen order.",
        severity: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(fetchKitchenOrders, 0);
    const intervalId = window.setInterval(fetchKitchenOrders, 8000);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
    };
  }, [fetchKitchenOrders]);

  const handleStatusAdvance = async (orderId, status) => {
    const nextStatus = nextKitchenStatus[status];
    if (!nextStatus) return;

    if (usingFallback) {
      setOrders((prev) =>
        nextStatus === "Completed"
          ? prev.filter((order) => order.id !== orderId)
          : prev.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order))
      );
      setSnackbar({ open: true, message: `Order #${orderId} moved to ${nextStatus}`, severity: "success" });
      return;
    }

    try {
      const response = await kitchenService.updateOrderStatus(orderId, nextStatus);
      if (response.success) {
        setOrders((prev) =>
          nextStatus === "Completed"
            ? prev.filter((order) => order.id !== orderId)
            : prev.map((order) => (order.id === orderId ? { ...order, ...response.data } : order))
        );
        setSnackbar({ open: true, message: `Order #${orderId} moved to ${nextStatus}`, severity: "success" });
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to update kitchen status", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Failed to update order status",
        severity: "error",
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const kitchenOrders = orders.filter((order) => kitchenStatuses.has(order.status || "Confirmed"));

  return (
    <Box sx={{ minHeight: "100vh", background: "#f6f7f9", padding: "24px" }}>
      <PageHeader
        badge="Live Kitchen"
        title="Kitchen Display"
        subtitle="Focus the kitchen team on active prep, item details, and ready handoff without admin clutter."
        actions={
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchKitchenOrders}>
            Refresh
          </Button>
        }
      />

      <StatGrid>
        <StatCard label="Active tickets" value={kitchenOrders.length} helper="Currently in kitchen" icon={<RestaurantIcon />} accent="#1976d2" />
        <StatCard label="Preparing" value={kitchenOrders.filter((order) => order.status === "Preparing").length} helper="Cooking now" icon={<AccessTimeIcon />} accent="#dc6b19" />
        <StatCard label="Auto refresh" value="8 sec" helper="Live kitchen sync" icon={<RoomServiceIcon />} accent="#059669" />
      </StatGrid>

      {usingFallback && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Backend kitchen orders are unavailable, so sample tickets are being shown for preview.
        </Alert>
      )}

      <KitchenBoard orders={kitchenOrders} loading={loading} onStatusAdvance={handleStatusAdvance} />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Kitchen;
