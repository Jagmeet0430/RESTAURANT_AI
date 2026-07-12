import apiClient from "./api";

// Customers Service
export const customersService = {
  // Get all customers
  getAllCustomers: async (limit = 50, offset = 0) => {
    const response = await apiClient.get(`/customers?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  // Get customer by ID
  getCustomerById: async (id) => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data;
  },

  // Get customer by phone
  getByPhone: async (phone) => {
    const response = await apiClient.get(`/customers/phone/${phone}`);
    return response.data;
  },

  // Get customer by email
  getByEmail: async (email) => {
    const response = await apiClient.get(`/customers/email/${email}`);
    return response.data;
  },

  // Create customer
  createCustomer: async (customerData) => {
    const response = await apiClient.post("/customers", customerData);
    return response.data;
  },

  // Update customer
  updateCustomer: async (id, customerData) => {
    const response = await apiClient.put(`/customers/${id}`, customerData);
    return response.data;
  },

  // Add loyalty points
  addLoyaltyPoints: async (id, points) => {
    const response = await apiClient.post(`/customers/${id}/loyalty`, { points });
    return response.data;
  },

  // Favorites
  getFavorites: async (id) => {
    const response = await apiClient.get(`/customers/${id}/favorites`);
    return response.data;
  },

  addFavorite: async (id, menu_id) => {
    const response = await apiClient.post(`/customers/${id}/favorites`, { menu_id });
    return response.data;
  },

  removeFavorite: async (id, menuId) => {
    const response = await apiClient.delete(`/customers/${id}/favorites/${menuId}`);
    return response.data;
  },

  // Search customers
  searchCustomers: async (query) => {
    const response = await apiClient.get(`/customers/search?query=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Delete customer
  deleteCustomer: async (id) => {
    const response = await apiClient.delete(`/customers/${id}`);
    return response.data;
  },
};

export default customersService;
