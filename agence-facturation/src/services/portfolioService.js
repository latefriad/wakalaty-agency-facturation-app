import { api } from "./api";

export const getPortfolioItems = async (params = {}) => {
  const res = await api.get("/portfolio", { limit: 100, ...params });
  return res.data;
};

export const addPortfolioItem = async (data) => {
  const res = await api.post("/portfolio", data);
  return res.data;
};

export const updatePortfolioItem = async (id, data) => {
  const res = await api.put(`/portfolio/${id}`, data);
  return res.data;
};

export const deletePortfolioItem = async (id) => {
  await api.delete(`/portfolio/${id}`);
};
