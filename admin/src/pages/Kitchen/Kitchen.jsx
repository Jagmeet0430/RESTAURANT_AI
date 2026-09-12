import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Snackbar } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import RoomServiceIcon from "@mui/icons-material/RoomService";
import KitchenBoard from "../../components/kitchen/KitchenBoard";
import { kitchenService } from "../../services/order";
import { PageHeader, StatCard, StatGrid } from "../../components/common/PageKit";

const LIVE_POLL_INTERVAL_MS = 3000;
const HIDDEN_POLL_INTERVAL_MS = 15000;

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
  const [ordersError, setOrdersError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const requestInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);
  const seenOrderIdsRef = useRef(new Set());
  const hasLoadedOnceRef = useRef(false);

  const fetchKitchenOrders = useCallback(async ({ silent = false } = {}) => {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const response = await kitchenService.getActiveOrders();
      if (response.success) {
        const nextOrders = response.data || [];
        const nextIds = new Set(nextOrders.map((order) => String(order.id)));
        const newOrderCount = nextOrders.filter((order) => !seenOrderIdsRef.current.has(String(order.id))).length;

        setOrders(nextOrders);
        if (hasLoadedOnceRef.current && newOrderCount > 0) {
          setSnackbar({
            open: true,
            message: `${newOrderCount} new kitchen ticket${newOrderCount === 1 ? "" : "s"} received.`,
            severity: "info",
          });
        }
        seenOrderIdsRef.current = nextIds;
        hasLoadedOnceRef.current = true;
        setUsingFallback(false);
        setOrdersError("");
        setLastSyncedAt(new Date());
      } else {
        setUsingFallback(true);
        setOrdersError(response.message || "Kitchen orders API did not return a successful response.");
        if (!silent) {
          setSnackbar({
            open: true,
            message: response.message || "Kitchen orders could not load.",
            severity: "warning",
          });
        }
      }
    } catch (error) {
      setUsingFallback(true);
      setOrdersError(error?.response?.data?.message || "Restaurant server unavailable. Reconnecting...");
      if (!silent) {
        setSnackbar({
          open: true,
          message: error?.response?.data?.message || "Restaurant server unavailable. Reconnecting...",
          severity: "warning",
        });
      }
    } finally {
      requestInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKitchenOrders();
  }, [fetchKitchenOrders]);

  useEffect(() => {
    let stopped = false;

    const scheduleNextPoll = () => {
      if (stopped) return;
      const interval = document.hidden ? HIDDEN_POLL_INTERVAL_MS : LIVE_POLL_INTERVAL_MS;
      pollTimerRef.current = window.setTimeout(runPoll, interval);
    };

    const runPoll = async () => {
      await fetchKitchenOrders({ silent: true });
      scheduleNextPoll();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      window.clearTimeout(pollTimerRef.current);
      runPoll();
    };

    pollTimerRef.current = window.setTimeout(runPoll, LIVE_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      window.clearTimeout(pollTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
        <StatCard label="Auto refresh" value="3 sec" helper="Live kitchen sync" icon={<RoomServiceIcon />} accent="#059669" />
      </StatGrid>

      {usingFallback && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {ordersError || "Restaurant server unavailable. Reconnecting..."}
        </Alert>
      )}

      {!usingFallback && lastSyncedAt && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Live sync active. Last update {lastSyncedAt.toLocaleTimeString()}.
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
