import { api } from "./api";

export const getInvoices = async (params = {}) => {
  const res = await api.get("/invoices", { limit: 100, ...params });
  return res.data;
};

// Variante paginée : renvoie { data, pagination } pour les pages avec navigation.
export const getInvoicesPage = async (params = {}) => {
  return api.get("/invoices", params);
};

export const addInvoice = async (data) => {
  const res = await api.post("/invoices", data);
  return res.data;
};

export const updateInvoiceStatus = async (id, status) => {
  const res = await api.patch(`/invoices/${id}/status`, { status });
  return res.data;
};

export const deleteInvoice = async (id) => {
  await api.delete(`/invoices/${id}`);
};
