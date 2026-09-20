export const EMPLOYEE_ROLES = ["EMPLOYEE", "EDITOR", "DESIGNER", "ADS", "VIDEO", "SEO"];
export const ADMIN_ROLES = ["ADMIN"];
// Le comptable accède aux pages de facturation (dashboard, clients, factures),
// pas aux employés/paramètres/abonnement.
export const ACCOUNTANT_ROLES = ["ADMIN", "ACCOUNTANT"];

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export const getColor = (name) => COLORS[name?.charCodeAt(0) % COLORS.length] || COLORS[0];

export const getInitials = (name) =>
  name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
