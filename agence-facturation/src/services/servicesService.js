import { api } from "./api";

export const getServices = async (params = {}) => {
  const res = await api.get("/services", { limit: 100, ...params });
  return res.data;
};

// Variante paginée : renvoie { data, pagination } pour les pages avec navigation.
export const getServicesPage = async (params = {}) => {
  return api.get("/services", params);
};

export const addService = async (data) => {
  const res = await api.post("/services", data);
  return res.data;
};

export const deleteService = async (id) => {
  await api.delete(`/services/${id}`);
};
