import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useLang } from "../i18n/LanguageContext";

// Remplace window.confirm() par une modale centrée aux couleurs du projet.
// Usage : const confirm = useConfirm();  if (!(await confirm(message))) return;
// Options : confirm("message")  ou  confirm({ message, title, danger, confirmText }).
const ConfirmContext = createContext(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const { t, dir } = useLang();
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    const options = typeof opts === "string" ? { message: opts } : opts || {};
    // Par défaut destructif (la plupart des confirmations sont des suppressions).
    setState({ danger: true, ...options });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result) => {
    setState(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  }, []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          onClick={() => close(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.55)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5000,
            padding: 20,
            direction: dir,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "26px 26px 22px",
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 24px 64px -12px rgba(15,23,42,.35)",
              textAlign: "center",
              fontFamily: "'Segoe UI', Tahoma, sans-serif",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                margin: "0 auto 14px",
                display: "grid",
                placeItems: "center",
                fontSize: 26,
                background: state.danger ? "#fee2e2" : "#dbeafe",
              }}
            >
              {state.danger ? "⚠️" : "❓"}
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              {state.title || t("confirm.title")}
            </h3>
            <p style={{ margin: "0 0 22px", fontSize: 15, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap", textAlign: "start" }}>
              {state.message}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => close(false)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 11,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                autoFocus
                onClick={() => close(true)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 11,
                  border: "none",
                  background: state.danger ? "#dc2626" : "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {state.confirmText || (state.danger ? t("confirm.deleteBtn") : t("confirm.confirmBtn"))}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
