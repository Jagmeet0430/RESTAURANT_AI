import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Snackbar, Typography } from "@mui/material";
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
    order_number: "101",
    status: "Preparing",
    items: [{ name: "Burger" }, { name: "Pizza" }],
  },
];

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const fetchKitchenOrders = async () => {
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
  };

  useEffect(() => {
    fetchKitchenOrders();
    const intervalId = window.setInterval(fetchKitchenOrders, 8000);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleMarkReady = async (orderId) => {
    if (usingFallback) {
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      setSnackbar({ open: true, message: `Order #${orderId} marked Ready`, severity: "success" });
      return;
    }

    try {
      const response = await kitchenService.updateOrderStatus(orderId, "Ready");
      if (response.success) {
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
        setSnackbar({ open: true, message: `Order #${orderId} marked Ready`, severity: "success" });
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
        <StatCard label="Active tickets" value={orders.length} helper="Currently in kitchen" icon={<RestaurantIcon />} accent="#1976d2" />
        <StatCard label="Preparing" value={orders.filter((order) => order.status === "Preparing").length} helper="Cooking now" icon={<AccessTimeIcon />} accent="#dc6b19" />
        <StatCard label="Auto refresh" value="8 sec" helper="Live kitchen sync" icon={<RoomServiceIcon />} accent="#059669" />
      </StatGrid>

      <KitchenBoard orders={orders} loading={loading} onMarkReady={handleMarkReady} />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Kitchen;
