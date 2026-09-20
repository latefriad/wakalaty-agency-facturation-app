import { api } from "./api";

export async function listContracts(params = {}) {
  const res = await api.get("/contracts", { limit: 100, ...params });
  return res.data;
}

export async function getContract(id) {
  const res = await api.get(`/contracts/${id}`);
  return res.data;
}

export async function createContract(data) {
  const res = await api.post("/contracts", data);
  return res.data;
}

export async function updateContract(id, data) {
  const res = await api.put(`/contracts/${id}`, data);
  return res.data;
}

export async function deleteContract(id) {
  await api.delete(`/contracts/${id}`);
}

export async function generateContractAIContent(data) {
  const res = await api.post("/contracts/generate", data);
  return res.data;
}
