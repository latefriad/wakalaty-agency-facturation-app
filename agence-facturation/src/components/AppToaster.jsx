import { Toaster } from "react-hot-toast";

// Notification centrée, moderne, aux couleurs du projet (bleu de marque +
// vert/rouge sémantiques). Montée une seule fois au niveau racine.
// Le mode sombre est géré globalement par le filtre d'inversion du body :
// la notification s'y adapte automatiquement.
export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={12}
      // Rapproche la pile du centre vertical de l'écran.
      containerStyle={{ top: "42%" }}
      toastOptions={{
        duration: 2800,
        style: {
          background: "#ffffff",
          color: "#0f172a",
          border: "1px solid #e6ebf3",
          borderRadius: "16px",
          padding: "16px 20px",
          fontSize: "15px",
          fontWeight: 600,
          fontFamily: "'Segoe UI', Tahoma, sans-serif",
          boxShadow:
            "0 1px 2px rgba(15,23,42,.04), 0 20px 50px -12px rgba(37,99,235,.25)",
          maxWidth: "420px",
          gap: "12px",
        },
        success: {
          iconTheme: { primary: "#059669", secondary: "#ffffff" },
          style: { borderInlineStart: "5px solid #059669" },
        },
        error: {
          iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
          style: { borderInlineStart: "5px solid #dc2626" },
        },
        loading: {
          iconTheme: { primary: "#2563eb", secondary: "#ffffff" },
          style: { borderInlineStart: "5px solid #2563eb" },
        },
      }}
    />
  );
}
