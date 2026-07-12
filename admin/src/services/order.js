import apiClient from "./api";

// Orders Service
export const ordersService = {
  // Get all orders
  getAllOrders: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.payment_status) params.append("payment_status", filters.payment_status);
    if (filters.customer_id) params.append("customer_id", filters.customer_id);
    if (filters.date) params.append("date", filters.date);
    if (filters.limit) params.append("limit", filters.limit);
    if (filters.offset) params.append("offset", filters.offset);

    const query = params.toString();
    const response = await apiClient.get(query ? `/orders?${query}` : "/orders");
    return response.data;
  },

  // Get order by ID with items
  getOrderById: async (id) => {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data;
  },

  // Get orders by status
  getOrdersByStatus: async (status) => {
    const response = await apiClient.get(`/orders/status/${status}`);
    return response.data;
  },

  // Create new order
  createOrder: async (orderData) => {
    const response = await apiClient.post("/orders", orderData);
    return response.data;
  },

  // Update order status
  updateOrderStatus: async (id, status, payment_status) => {
    const response = await apiClient.put(`/orders/${id}`, {
      status,
      payment_status,
    });
    return response.data;
  },
};

// Kitchen Service
export const kitchenService = {
  // Get all active orders
  getActiveOrders: async () => {
    const response = await apiClient.get("/kitchen/orders");
    return response.data;
  },

  // Get orders by status
  getOrdersByStatus: async (status) => {
    const response = await apiClient.get(`/kitchen/orders/status/${status}`);
    return response.data;
  },

  // Update order status
  updateOrderStatus: async (id, status) => {
    const response = await apiClient.put(`/kitchen/orders/${id}/status`, {
      status,
    });
    return response.data;
  },
};

export default ordersService;
