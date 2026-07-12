import apiClient from "./api";

// Menu Service
export const menuService = {
  // Get all menu items
  getAllItems: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append("category", filters.category);
    if (filters.search) params.append("search", filters.search);
    if (filters.available !== undefined) params.append("available", filters.available);

    const response = await apiClient.get(`/menu?${params}`);
    return response.data;
  },

  // Get single menu item
  getItemById: async (id) => {
    const response = await apiClient.get(`/menu/${id}`);
    return response.data;
  },

  // Get featured items
  getFeaturedItems: async () => {
    const response = await apiClient.get("/menu/featured");
    return response.data;
  },

  // Create menu item
  createItem: async (itemData) => {
    const response = await apiClient.post("/menu", itemData);
    return response.data;
  },

  // Update menu item
  updateItem: async (id, itemData) => {
    const response = await apiClient.put(`/menu/${id}`, itemData);
    return response.data;
  },

  // Delete menu item
  deleteItem: async (id) => {
    const response = await apiClient.delete(`/menu/${id}`);
    return response.data;
  },
};

// Categories Service
export const categoriesService = {
  // Get all categories
  getAllCategories: async () => {
    const response = await apiClient.get("/categories");
    return response.data;
  },

  // Get category by ID
  getCategoryById: async (id) => {
    const response = await apiClient.get(`/categories/${id}`);
    return response.data;
  },

  // Create category
  createCategory: async (categoryData) => {
    const response = await apiClient.post("/categories", categoryData);
    return response.data;
  },

  // Update category
  updateCategory: async (id, categoryData) => {
    const response = await apiClient.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  // Delete category
  deleteCategory: async (id) => {
    const response = await apiClient.delete(`/categories/${id}`);
    return response.data;
  },
};

export default menuService;
