import { api } from "./api";

export async function getLeads(params = {}) {
  const res = await api.get("/leads", params);
  return res.data;
}

export async function getLead(id) {
  const res = await api.get(`/leads/${id}`);
  return res.data;
}

export async function createLead(data) {
  const res = await api.post("/leads", data);
  return res.data;
}

export async function updateLead(id, data) {
  const res = await api.patch(`/leads/${id}`, data);
  return res.data;
}

export async function changeLeadStage(id, stage, lostReason = null) {
  const res = await api.patch(`/leads/${id}/stage`, { stage, lostReason });
  return res.data;
}

export async function deleteLead(id) {
  const res = await api.delete(`/leads/${id}`);
  return res.data;
}

export async function addLeadNote(id, content) {
  const res = await api.post(`/leads/${id}/notes`, { content });
  return res.data;
}

export async function convertLeadToClient(id) {
  const res = await api.post(`/leads/${id}/convert`, {});
  return res.data;
}
