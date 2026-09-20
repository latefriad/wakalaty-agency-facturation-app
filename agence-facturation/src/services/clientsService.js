import { api } from "./api";

export const getClients = async (params = {}) => {
  const res = await api.get("/clients", { limit: 100, ...params });
  return res.data;
};

// Variante paginée : renvoie { data, pagination } pour les pages avec navigation.
export const getClientsPage = async (params = {}) => {
  return api.get("/clients", params);
};

// Fiche 360° : client + factures/contrats/tâches + encours financier.
export const getClientOverview = async (id) => {
  const res = await api.get(`/clients/${id}/overview`);
  return res.data;
};

export const checkDuplicateClient = async ({ email, name, company, excludeId }) => {
  const res = await api.get("/clients/meta/check-duplicate", { email, name, company, excludeId });
  return res.data;
};

export const getClientTags = async () => {
  const res = await api.get("/clients/meta/tags");
  return res.data;
};

export const addClientNote = async (clientId, content) => {
  const res = await api.post(`/clients/${clientId}/notes`, { content });
  return res.data;
};

export const deleteClientNote = async (clientId, noteId) => {
  await api.delete(`/clients/${clientId}/notes/${noteId}`);
};

export const addClient = async (data) => {
  const res = await api.post("/clients", data);
  return res.data;
};

export const updateClient = async (id, data) => {
  const res = await api.put(`/clients/${id}`, data);
  return res.data;
};

export const deleteClient = async (id) => {
  await api.delete(`/clients/${id}`);
};
