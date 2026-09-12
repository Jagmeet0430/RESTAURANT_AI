import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import HistoryIcon from "@mui/icons-material/History";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import RoomServiceIcon from "@mui/icons-material/RoomService";
import { useSearchParams } from "react-router-dom";
import OrdersTable from "../../components/orders/OrdersTable";
import OrderFilters from "../../components/orders/OrderFilters";
import OrderDetails from "../../components/orders/OrderDetails";
import OrderBoard from "../../components/orders/OrderBoard";
import { ordersService } from "../../services/order";

const LIVE_POLL_INTERVAL_MS = 3000;
const HIDDEN_POLL_INTERVAL_MS = 15000;

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function StatCard({ label, value, helper, icon, accent = "#1976d2" }) {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: `${accent}14`,
            color: accent,
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, color: "#6b7280", fontWeight: 800 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#6b7280" }}>{helper}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function matchesSearch(order, query) {
  if (!query) return true;

  const itemText = (order.items || [])
    .map((item) => `${item.name || item} ${item.quantity || ""}`)
    .join(" ");
  const text = [
    order.id,
    order.order_number,
    order.table_number ? `table ${order.table_number}` : "",
    order.customer_name,
    order.customer_phone,
    order.status,
    order.payment_status,
    itemText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

function Orders() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("table")
    ? `table ${searchParams.get("table")}`
    : searchParams.get("search") || "";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    payment_status: "",
    date: "",
    search: initialSearch,
  });
  const [viewMode, setViewMode] = useState("board");
  const [orderScope, setOrderScope] = useState("live");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const requestInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);
  const seenOrderIdsRef = useRef(new Set());
  const hasLoadedOnceRef = useRef(false);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const response = await ordersService.getAllOrders({
        status: filters.status,
        payment_status: filters.payment_status,
        date: filters.date,
        include_expired: orderScope === "history",
      });
      if (response.success) {
        const nextOrders = response.data || [];
        const nextIds = new Set(nextOrders.map((order) => String(order.id)));
        const newOrderCount = nextOrders.filter((order) => !seenOrderIdsRef.current.has(String(order.id))).length;

        setOrders(nextOrders);
        setSelectedOrder((current) => {
          if (!current) return current;
          return nextOrders.find((order) => Number(order.id) === Number(current.id)) || current;
        });
        if (hasLoadedOnceRef.current && newOrderCount > 0 && orderScope === "live") {
          setSnackbar({
            open: true,
            message: `${newOrderCount} new order${newOrderCount === 1 ? "" : "s"} received.`,
            severity: "info",
          });
        }
        seenOrderIdsRef.current = nextIds;
        hasLoadedOnceRef.current = true;
        setUsingFallback(false);
        setOrdersError("");
        setLastSyncedAt(new Date());
      } else {
        const message = response.message || "Live orders API did not return a successful response.";
        setUsingFallback(true);
        setOrdersError(message);
        if (!silent) setSnackbar({ open: true, message, severity: "warning" });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        (!error?.response
          ? "Restaurant server unavailable. Reconnecting..."
          : "Live orders could not be loaded from the backend.");
      setUsingFallback(true);
      setOrdersError(message);
      if (!silent) {
        setSnackbar({
          open: true,
          message,
          severity: "warning",
        });
      }
    } finally {
      requestInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }, [filters.status, filters.payment_status, filters.date, orderScope]);

  useEffect(() => {
    seenOrderIdsRef.current = new Set();
    hasLoadedOnceRef.current = false;
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    let stopped = false;

    const scheduleNextPoll = () => {
      if (stopped) return;
      const interval = document.hidden ? HIDDEN_POLL_INTERVAL_MS : LIVE_POLL_INTERVAL_MS;
      pollTimerRef.current = window.setTimeout(runPoll, interval);
    };

    const runPoll = async () => {
      await loadOrders({ silent: true });
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
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (usingFallback) {
        if (filters.status && order.status !== filters.status) return false;
        if (filters.payment_status && order.payment_status !== filters.payment_status) return false;
        if (
          filters.date &&
          order.created_at &&
          new Date(order.created_at).toISOString().slice(0, 10) !== filters.date
        ) {
          return false;
        }
      }

      return matchesSearch(order, filters.search || "");
    });
  }, [orders, filters, usingFallback]);

  const stats = useMemo(() => {
    const active = filteredOrders.filter(
      (order) => !["Completed", "Cancelled"].includes(order.status)
    ).length;
    const ready = filteredOrders.filter((order) => order.status === "Ready").length;
    const paid = filteredOrders.filter((order) => order.payment_status === "Paid").length;
    const revenue = filteredOrders
      .filter((order) => order.status !== "Cancelled")
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    return {
      total: filteredOrders.length,
      active,
      ready,
      paid,
      revenue,
    };
  }, [filteredOrders]);

  const handleStatusChange = async (orderId, newStatus, extra = {}) => {
    if (usingFallback) {
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)));
      setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, status: newStatus } : prev));
      setSnackbar({ open: true, message: `Order #${orderId} moved to ${newStatus}`, severity: "success" });
      return;
    }

    try {
      const response = await ordersService.updateOrderStatus(orderId, newStatus, null, extra);
      if (response.success) {
        setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, ...response.data } : order)));
        setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, ...response.data } : prev));
        setSnackbar({
          open: true,
          message: "Order status updated. Kitchen will refresh automatically.",
          severity: "success",
        });
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to update order", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Failed to update order",
        severity: "error",
      });
    }
  };

  const handleViewDetails = async (order) => {
    if (usingFallback) {
      setSelectedOrder(order);
      setDetailsOpen(true);
      return;
    }

    try {
      const response = await ordersService.getOrderById(order.id);
      setSelectedOrder(response.success ? response.data : order);
    } catch {
      setSelectedOrder(order);
    } finally {
      setDetailsOpen(true);
    }
  };

  const handleMarkPaid = async (orderId) => {
    const orderForPayment = orders.find((order) => Number(order.id) === Number(orderId)) || selectedOrder;
    const expectedTotal = Number(orderForPayment?.total_amount || 0);
    const confirmed = window.confirm(
      `Mark ${orderForPayment?.order_number || `order #${orderId}`} paid after collecting ${formatCurrency(expectedTotal)}?`
    );

    if (!confirmed) return;

    if (usingFallback) {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, payment_status: "Paid", transaction_id: order.transaction_id || `offline-${orderId}` }
            : order
        )
      );
      setSnackbar({ open: true, message: `Order #${orderId} marked paid`, severity: "success" });
      return;
    }

    try {
      const response = await ordersService.markPaymentPaid(orderId, {
        payment_method: "cash",
        expected_total: expectedTotal,
      });

      if (response.success) {
        setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, ...response.data } : order)));
        setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, ...response.data } : prev));
        setSnackbar({ open: true, message: "Cash payment marked as paid.", severity: "success" });
      } else {
        setSnackbar({ open: true, message: response.message || "Unable to mark payment paid", severity: "error" });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Unable to mark payment paid",
        severity: "error",
      });
    }
  };

  const handleRetryWhatsApp = async (orderId) => {
    try {
      const response = await ordersService.retryWhatsAppNotification(orderId);
      setSnackbar({
        open: true,
        message: response.message || "WhatsApp notification retried.",
        severity: response.success ? "success" : "error",
      });
      loadOrders();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error.message || "Unable to retry WhatsApp notification",
        severity: "error",
      });
    }
  };

  const closeSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ padding: "20px" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Order Command Center
          </Typography>
          <Typography color="text.secondary">
            {orderScope === "history"
              ? "Review every stored order, including completed and cancelled orders hidden from live operations."
              : "Track every order from new request to kitchen preparation, ready handoff, and completion."}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={orderScope}
            onChange={(event, nextScope) => {
              if (nextScope) setOrderScope(nextScope);
            }}
          >
            <ToggleButton value="live">Live</ToggleButton>
            <ToggleButton value="history">
              <HistoryIcon sx={{ fontSize: 17, mr: 0.6 }} />
              History
            </ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(event, nextView) => {
              if (nextView) setViewMode(nextView);
            }}
          >
            <ToggleButton value="board">Board view</ToggleButton>
            <ToggleButton value="table">Table view</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadOrders}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {usingFallback && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={loadOrders}>
              Refresh
            </Button>
          }
        >
          {ordersError || "Restaurant server unavailable. Reconnecting..."}
        </Alert>
      )}

      {!usingFallback && lastSyncedAt && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Live sync active. Last update {lastSyncedAt.toLocaleTimeString()}.
        </Alert>
      )}

      {orderScope === "history" && !usingFallback && (
        <Alert severity="info" sx={{ mb: 2 }}>
          History mode includes orders removed from the live board after 20 minutes.
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          label="Visible orders"
          value={stats.total}
          helper={`${stats.active} active right now`}
          icon={<RoomServiceIcon />}
          accent="#1976d2"
        />
        <StatCard
          label="Ready to serve"
          value={stats.ready}
          helper="Waiting for handoff"
          icon={<LocalFireDepartmentIcon />}
          accent="#059669"
        />
        <StatCard
          label="Paid orders"
          value={stats.paid}
          helper="Payment confirmed"
          icon={<PaidOutlinedIcon />}
          accent="#7c3aed"
        />
        <StatCard
          label="Visible revenue"
          value={formatCurrency(stats.revenue)}
          helper="Excludes cancelled orders"
          icon={<CurrencyRupeeIcon />}
          accent="#dc6b19"
        />
      </Box>

      <OrderFilters filters={filters} onFilterChange={setFilters} />

      {viewMode === "board" ? (
        <OrderBoard
          orders={filteredOrders}
          onViewDetails={handleViewDetails}
          onStatusChange={handleStatusChange}
          onMarkPaid={handleMarkPaid}
        />
      ) : (
        <OrdersTable
          orders={filteredOrders}
          loading={loading}
          onViewDetails={handleViewDetails}
          onStatusChange={handleStatusChange}
          onMarkPaid={handleMarkPaid}
        />
      )}

      <OrderDetails
        open={detailsOpen}
        order={selectedOrder}
        onClose={() => setDetailsOpen(false)}
        onStatusUpdate={handleStatusChange}
        onMarkPaid={handleMarkPaid}
        onRetryWhatsApp={handleRetryWhatsApp}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Orders;
