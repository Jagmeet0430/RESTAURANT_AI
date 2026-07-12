import apiClient from "./api";

export const couponsService = {
  getAllCoupons: async () => {
    const response = await apiClient.get("/coupons");
    return response.data;
  },

  createCoupon: async (couponData) => {
    const response = await apiClient.post("/coupons", couponData);
    return response.data;
  },

  updateCoupon: async (id, couponData) => {
    const response = await apiClient.put(`/coupons/${id}`, couponData);
    return response.data;
  },

  deleteCoupon: async (id) => {
    const response = await apiClient.delete(`/coupons/${id}`);
    return response.data;
  },
};

export default couponsService;
