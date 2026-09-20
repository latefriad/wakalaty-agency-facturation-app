import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { LANGUAGES, translate } from "./translations";

const LanguageContext = createContext();

const STORAGE_KEY = "wakalati_lang";

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === saved) ? saved : "ar";
  });

  const langDef = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  // La direction est posée sur <html> : tout le layout (y compris les pages
  // non encore traduites) hérite du bon sens de lecture.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.dir = langDef.dir;
    document.documentElement.lang = lang;
  }, [lang, langDef.dir]);

  const t = useCallback((key, params) => translate(lang, key, params), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir: langDef.dir, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

/**
 * Drapeau d'une langue, dessiné en SVG plutôt qu'en emoji : les drapeaux
 * emoji régionaux ne s'affichent PAS sur Windows ni sur beaucoup d'Android
 * (ils tombent en toutes lettres, ex. « DZ »), fréquent chez les
 * utilisateurs visés. Le SVG s'affiche identiquement partout.
 * La classe `no-invert` empêche le filtre du mode sombre de fausser les
 * couleurs du drapeau. Repli sur l'emoji si une langue n'a pas de dessin.
 */
function FlagIcon({ lang, size = 15 }) {
  const box = {
    width: size * 1.4,
    height: size,
    borderRadius: 2,
    verticalAlign: "middle",
    display: "inline-block",
  };

  if (lang.code === "ar") {
    return (
      <svg viewBox="0 0 30 20" style={box} className="no-invert" role="img" aria-label="الجزائر">
        <rect width="15" height="20" fill="#006233" />
        <rect x="15" width="15" height="20" fill="#fff" />
        <g fill="#d21034">
          <circle cx="14.6" cy="10" r="4" />
          <circle cx="16.2" cy="10" r="3.3" fill="#fff" />
          <polygon points="16.9,7.9 17.39,9.32 18.9,9.35 17.7,10.26 18.13,11.7 16.9,10.84 15.67,11.7 16.1,10.26 14.9,9.35 16.41,9.32" />
        </g>
      </svg>
    );
  }

  if (lang.code === "fr") {
    return (
      <svg viewBox="0 0 30 20" style={box} className="no-invert" role="img" aria-label="France">
        <rect width="10" height="20" fill="#0055A4" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#EF4135" />
      </svg>
    );
  }

  if (lang.code === "en") {
    return (
      <svg viewBox="0 0 60 30" style={box} className="no-invert" role="img" aria-label="English">
        <clipPath id="uk-clip">
          <path d="M0,0 v30 h60 v-30 z" />
        </clipPath>
        <clipPath id="uk-diag">
          <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
        </clipPath>
        <g clipPath="url(#uk-clip)">
          <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-diag)" stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </g>
      </svg>
    );
  }

  return <span style={{ fontSize: size }}>{lang.flag}</span>;
}

/** Sélecteur compact de langue (drapeaux) réutilisable partout. */
export function LanguageSwitcher({ compact = false }) {
  const { lang, setLang, languages } = useLang();
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          title={l.label}
          style={{
            padding: compact ? "4px 8px" : "6px 10px",
            borderRadius: 8,
            border: lang === l.code ? "2px solid #3b82f6" : "1px solid rgba(148,163,184,0.4)",
            background: lang === l.code ? "rgba(59,130,246,0.12)" : "transparent",
            cursor: "pointer",
            fontSize: compact ? 13 : 15,
            lineHeight: 1,
          }}
        >
          <FlagIcon lang={l} size={compact ? 13 : 15} />
        </button>
      ))}
    </div>
  );
}
