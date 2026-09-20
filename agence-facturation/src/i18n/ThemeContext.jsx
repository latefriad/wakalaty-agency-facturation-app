import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();
const STORAGE_KEY = "wakalati_theme";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    // Le rendu sombre est fait en CSS via html[data-theme="dark"] (index.css) :
    // l'app est stylée inline avec des couleurs claires en dur, un filtre
    // d'inversion global est la seule approche qui couvre tout d'un coup.
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
