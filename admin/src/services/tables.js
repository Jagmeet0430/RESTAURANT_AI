import apiClient from "./api";

export const tablesService = {
  getAllTables: async () => {
    const response = await apiClient.get("/tables");
    return response.data;
  },

  createTable: async (tableData) => {
    const response = await apiClient.post("/tables", tableData);
    return response.data;
  },

  updateTable: async (id, tableData) => {
    const response = await apiClient.put(`/tables/${id}`, tableData);
    return response.data;
  },

  regenerateQr: async (id) => {
    const response = await apiClient.post(`/tables/${id}/regenerate-token`);
    return response.data;
  },
};

export default tablesService;
