import { api } from "./api";

export const getEmployees = async (params = {}) => {
  const res = await api.get("/employees", { limit: 100, ...params });
  return res.data;
};

// Variante paginée : renvoie { data, pagination } pour les pages avec navigation.
export const getEmployeesPage = async (params = {}) => {
  return api.get("/employees", params);
};

export const addEmployee = async (data) => {
  const res = await api.post("/employees", data);
  return res.data;
};

export const deleteEmployee = async (id) => {
  await api.delete(`/employees/${id}`);
};
