import apiClient from "./api";

export const billsService = {
  getBills: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.range) params.append("range", filters.range);
    if (filters.status) params.append("status", filters.status);
    if (filters.method) params.append("method", filters.method);
    if (filters.search) params.append("search", filters.search);
    if (filters.limit) params.append("limit", filters.limit);

    const query = params.toString();
    const response = await apiClient.get(query ? `/bills?${query}` : "/bills");
    return response.data;
  },

  getReceipt: async (source, id) => {
    const response = await apiClient.get(`/bills/receipt/${encodeURIComponent(source)}/${encodeURIComponent(id)}`);
    return response.data;
  },

  getTableDues: async () => {
    const response = await apiClient.get("/bills/tables/due");
    return response.data;
  },

  payOrder: async (orderId, payload) => {
    const response = await apiClient.post(`/bills/orders/${orderId}/pay`, payload);
    return response.data;
  },

  settleTable: async (tableId, payload) => {
    const response = await apiClient.post(`/bills/tables/${tableId}/settle`, payload);
    return response.data;
  },

  getEndOfDay: async () => {
    const response = await apiClient.get("/bills/end-of-day");
    return response.data;
  },

  getEndOfDayForDate: async (date) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    const query = params.toString();
    const response = await apiClient.get(query ? `/bills/end-of-day?${query}` : "/bills/end-of-day");
    return response.data;
  },

  getSettlementHistory: async (limit = 30) => {
    const response = await apiClient.get(`/bills/end-of-day/history?limit=${encodeURIComponent(limit)}`);
    return response.data;
  },

  closeEndOfDay: async (payload) => {
    const response = await apiClient.post("/bills/end-of-day/close", payload);
    return response.data;
  },
};

export default billsService;
