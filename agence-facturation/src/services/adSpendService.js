import { api, apiDownload } from "./api";

export async function getAdSpend(params = {}) {
  const res = await api.get("/adspend", params);
  return res.data;
}

export async function getAdSpendSummary(params = {}) {
  const res = await api.get("/adspend/summary", params);
  return res.data;
}

export async function createAdSpend(data) {
  const res = await api.post("/adspend", data);
  return res.data;
}

export async function updateAdSpend(id, data) {
  const res = await api.patch(`/adspend/${id}`, data);
  return res.data;
}

export async function deleteAdSpend(id) {
  const res = await api.delete(`/adspend/${id}`);
  return res.data;
}

export async function exportAdSpendExcel(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const endpoint = `/adspend/export${qs ? `?${qs}` : ""}`;
  const filename = `wakalati-adspend-${params.month || "global"}.xlsx`;
  await apiDownload(endpoint, filename);
}
