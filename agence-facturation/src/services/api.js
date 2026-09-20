const API_BASE = process.env.REACT_APP_API_URL || "https://wakalaty-agency-facturation-app.onrender.com/api";

function getToken() {
  return localStorage.getItem("wakalati_token");
}

export function setToken(token) {
  localStorage.setItem("wakalati_token", token);
}

export function clearToken() {
  localStorage.removeItem("wakalati_token");
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const url = `${API_BASE}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Session expirée");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const e = new Error(err.message || `Erreur ${res.status}`);
    // Code d'erreur stable (ex. licence : "revoked", "expired") pour permettre
    // au front d'afficher un message traduit plutôt que le message serveur brut.
    if (err.code) e.code = err.code;
    e.status = res.status;
    throw e;
  }

  return res.json();
}

function withQuery(endpoint, params) {
  if (!params || Object.keys(params).length === 0) return endpoint;
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  return qs ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}${qs}` : endpoint;
}

// Upload multipart (documents RH…) : pas de Content-Type JSON, le navigateur
// pose le boundary lui-même.
export async function apiUpload(endpoint, formData) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Erreur ${res.status}`);
  }
  return res.json();
}

// Téléchargement authentifié : les fichiers ne sont pas servis statiquement
// (données RH), il faut passer le token — donc fetch + blob, pas un <a href>.
export async function apiDownload(endpoint, filename) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || "document";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export const api = {
  get: (endpoint, params) => request(withQuery(endpoint, params)),
  post: (endpoint, data) =>
    request(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: (endpoint, data) =>
    request(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  patch: (endpoint, data) =>
    request(endpoint, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (endpoint) => request(endpoint, { method: "DELETE" }),
};
