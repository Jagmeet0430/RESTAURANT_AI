import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import RoomServiceIcon from "@mui/icons-material/RoomService";
import OrdersTable from "../../components/orders/OrdersTable";
import OrderFilters from "../../components/orders/OrderFilters";
import OrderDetails from "../../components/orders/OrderDetails";
import OrderBoard from "../../components/orders/OrderBoard";
import { ordersService } from "../../services/order";

const PHASE_6_FALLBACK_ORDERS = [
  {
    id: 101,
    order_number: "ORD-101",
    table_number: 5,
    customer_name: "Table 5",
    customer_phone: "",
    delivery_address: "",
    items: [
      { name: "Paneer Tikka Pizza", quantity: 2, unit_price: 220, total_price: 440 },
      { name: "Veggie Noodles", quantity: 1, unit_price: 120, total_price: 120 },
    ],
    subtotal: 560,
    tax: 28,
    delivery_charge: 0,
    total_amount: 588,
    payment_status: "Pending",
    status: "Pending",
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
    special_instructions: "Less spicy.",
  },
  {
    id: 102,
    order_number: "ORD-102",
    table_number: 2,
    customer_name: "Aman Singh",
    items: [{ name: "Spicy Veg Burger", quantity: 2, unit_price: 80, total_price: 160 }],
    subtotal: 160,
    tax: 8,
    delivery_charge: 0,
    total_amount: 168,
    payment_status: "Paid",
    status: "Preparing",
    created_at: new Date(Date.now() - 22 * 60000).toISOString(),
  },
  {
    id: 103,
    order_number: "ORD-103",
    customer_name: "Priya Sharma",
    customer_phone: "+91-9876543212",
    items: [
      { name: "Dahi Golgappe (Per 6 Pcs)", quantity: 1, unit_price: 60, total_price: 60 },
      { name: "Sev Puri", quantity: 1, unit_price: 60, total_price: 60 },
    ],
    subtotal: 120,
    tax: 6,
    delivery_charge: 50,
    total_amount: 176,
    payment_status: "Paid",
    status: "Ready",
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: 104,
    order_number: "ORD-104",
    customer_name: "Rahul Kumar",
    items: [{ name: "Chocolate Muffins", quantity: 4, unit_price: 50, total_price: 200 }],
    subtotal: 200,
    tax: 10,
    delivery_charge: 0,
    total_amount: 210,
    payment_status: "Paid",
    status: "Completed",
    created_at: new Date(Date.now() - 90 * 60000).toISOString(),
  },
];

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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    payment_status: "",
    date: "",
    search: "",
  });
  const [viewMode, setViewMode] = useState("board");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ordersService.getAllOrders({
        status: filters.status,
        payment_status: filters.payment_status,
        date: filters.date,
      });
      if (response.success) {
        setOrders(response.data || []);
        setUsingFallback(false);
      } else {
        setOrders(PHASE_6_FALLBACK_ORDERS);
        setUsingFallback(true);
        setSnackbar({ open: true, message: response.message || "Showing sample orders", severity: "warning" });
      }
    } catch (error) {
      setOrders(PHASE_6_FALLBACK_ORDERS);
      setUsingFallback(true);
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || "Backend unavailable. Showing sample orders.",
        severity: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.payment_status, filters.date]);

  useEffect(() => {
    loadOrders();
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

  const handleStatusChange = async (orderId, newStatus) => {
    if (usingFallback) {
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)));
      setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, status: newStatus } : prev));
      setSnackbar({ open: true, message: `Order #${orderId} moved to ${newStatus}`, severity: "success" });
      return;
    }

    try {
      const response = await ordersService.updateOrderStatus(orderId, newStatus);
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
            Track every order from new request to kitchen preparation, ready handoff, and completion.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
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
        <Alert severity="warning" sx={{ mb: 2 }}>
          Backend orders are unavailable, so sample orders are being shown for preview.
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
        />
      ) : (
        <OrdersTable
          orders={filteredOrders}
          loading={loading}
          onViewDetails={handleViewDetails}
          onStatusChange={handleStatusChange}
        />
      )}

      <OrderDetails
        open={detailsOpen}
        order={selectedOrder}
        onClose={() => setDetailsOpen(false)}
        onStatusUpdate={handleStatusChange}
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
