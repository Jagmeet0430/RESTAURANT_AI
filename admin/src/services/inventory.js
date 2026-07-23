import apiClient from "./api";

export const inventoryService = {
  getItems: async () => {
    const response = await apiClient.get("/inventory");
    return response.data;
  },

  getSummary: async () => {
    const response = await apiClient.get("/inventory/summary");
    return response.data;
  },

  createItem: async (data) => {
    const response = await apiClient.post("/inventory", data);
    return response.data;
  },

  updateItem: async (id, data) => {
    const response = await apiClient.put(`/inventory/${id}`, data);
    return response.data;
  },

  deleteItem: async (id) => {
    const response = await apiClient.delete(`/inventory/${id}`);
    return response.data;
  },

  createTransaction: async (id, data) => {
    const response = await apiClient.post(`/inventory/${id}/transactions`, data);
    return response.data;
  },

  getTransactions: async () => {
    const response = await apiClient.get("/inventory/transactions");
    return response.data;
  },

  lookupBarcode: async (barcode) => {
    const response = await apiClient.get(`/inventory/barcode/${encodeURIComponent(barcode)}`);
    return response.data;
  },

  receiveStock: async (data) => {
    const response = await apiClient.post("/inventory/receive", data);
    return response.data;
  },
};

export const supplierService = {
  getSuppliers: async () => {
    const response = await apiClient.get("/suppliers");
    return response.data;
  },

  createSupplier: async (data) => {
    const response = await apiClient.post("/suppliers", data);
    return response.data;
  },
};
