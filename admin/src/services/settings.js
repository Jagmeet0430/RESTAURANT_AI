import apiClient from "./api";

export const settingsService = {
  getOrderNotificationSettings: async (options = {}) =>
    (await apiClient.get('/settings/order-notifications', options)).data,
  getSettings: async () => {
    const response = await apiClient.get("/settings");
    return response.data;
  },

  updateSettings: async (settings) => {
    const response = await apiClient.put("/settings", settings);
    return response.data;
  },
};

export default settingsService;
