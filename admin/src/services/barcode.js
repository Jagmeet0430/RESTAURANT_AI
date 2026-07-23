import apiClient from "./api";

export const barcodeService = {
  lookup: async (barcode) => {
    const response = await apiClient.get(`/inventory/barcode/${encodeURIComponent(barcode)}`);
    return response.data;
  },

  createCounterSale: async (payload) => {
    const response = await apiClient.post("/counter-sales/checkout", payload);
    return response.data;
  },

  stockIn: async (payload) => {
    const response = await apiClient.post("/inventory/receive", payload);
    return response.data;
  },
};

export default barcodeService;
