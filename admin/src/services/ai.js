import apiClient from "./api";

export async function predictSales(payload) {
  const resp = await apiClient.post("/ai/predict", payload);
  return resp.data;
}

export default { predictSales };
