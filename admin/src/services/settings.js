import apiClient from "./api";

export const settingsService = {
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
