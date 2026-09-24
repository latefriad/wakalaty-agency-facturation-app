import { useState } from "react";
import { useLang, LanguageSwitcher } from "../i18n/LanguageContext";
import { Link } from "react-router-dom";

export default function Landing() {
  const { t, lang } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const PRIMARY = "#2563eb";
  const DARK = "#0f172a";

  const FEATURES = [
    {
      icon: "🧾",
      title: t("land.f1t"),
      desc: t("land.f1d"),
    },
    {
      icon: "👥",
      title: t("land.f2t"),
      desc: t("land.f2d"),
    },
    { icon: "📋", title: t("land.f3t"), desc: t("land.f3d") },
    {
      icon: "👤",
      title: t("land.f4t"),
      desc: t("land.f4d"),
    },
    { icon: "📄", title: t("land.f5t"), desc: t("land.f5d") },
    { icon: "📊", title: t("land.f6t"), desc: t("land.f6d") },
  ];

  const PLANS = [
    {
      name: t("sub.planFree"),
      price: "0",
      period: t("land.forever"),
      color: "var(--text-muted)",
      popular: false,
      features: ["3 " + t("nav.clients"), "10 " + t("nav.invoices"), "1 " + t("role.EMPLOYEE")],
    },
    {
      name: "Pro ⭐",
      price: "2,900",
      period: t("land.monthly"),
      color: PRIMARY,
      popular: true,
      features: [
        t("upg.f1"),
        t("upg.f2"),
        t("upg.f3"),
        t("upg.f4"),
        t("upg.f5"),
      ],
    },
    {
      name: "Business 💎",
      price: "7,900",
      period: t("land.monthly"),
      color: "#7c3aed",
      popular: false,
      features: [lang === "ar" ? "كل مميزات Pro" : lang === "fr" ? "Tout le plan Pro" : "Everything in Pro", lang === "ar" ? "موظفون غير محدودين" : lang === "fr" ? "Employés illimités" : "Unlimited employees", "API Access", lang === "ar" ? "دعم 24/7" : lang === "fr" ? "Support 24/7" : "24/7 support"],
    },
  ];

  const FAQS = [
    {
      q: t("land.faq1q"),
      a: t("land.faq1a"),
    },
    {
      q: t("land.faq2q"),
      a: t("land.faq2a"),
    },
    { q: t("land.faq3q"), a: t("land.faq3a") },
    { q: t("land.faq4q"), a: t("land.faq4a") },
    {
      q: t("land.faq5q"),
      a: t("land.faq5a"),
    },
  ];

  return (
    <div
      style={{
        direction: "inherit",
        fontFamily: "'Segoe UI',Tahoma,sans-serif",
        color: DARK,
        overflowX: "hidden",
        margin: 0,
        padding: 0,
        background: "var(--bg-card)",
      }}
    >
      {/* ══ NAVBAR ══ */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-color)",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(16px,5vw,80px)",
          gap: 12,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg,${PRIMARY},#7c3aed)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🏢
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: DARK, lineHeight: 1 }}>
              AgenceApp
            </div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.05em" }}>MARKETING SAAS</div>
          </div>
        </div>

        {/* Desktop Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LanguageSwitcher compact />
          <Link
            to="/pricing"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              color: "var(--text-muted)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
              border: "1px solid transparent",
            }}
          >
            {t("land.pricingNav")}
          </Link>
          <Link
            to="/login"
            style={{
              padding: "8px 18px",
              borderRadius: 9,
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {t("land.loginNav")}
          </Link>
          <Link
            to="/register"
            style={{
              padding: "8px 20px",
              borderRadius: 9,
              background: PRIMARY,
              color: "var(--bg-card)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              boxShadow: `0 2px 10px ${PRIMARY}40`,
              whiteSpace: "nowrap",
            }}
          >
            {t("land.startFree")}
          </Link>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section
        style={{
          padding: "clamp(60px,10vw,120px) clamp(16px,5vw,80px)",
          background: "linear-gradient(160deg,#f0f9ff 0%,#e0f2fe 50%,#f0fdf4 100%)",
          textAlign: "center",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#dbeafe",
            border: "1px solid #93c5fd",
            color: "var(--primary-hover)",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          {t("land.badge")}
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(28px,5.5vw,58px)",
            fontWeight: 900,
            lineHeight: 1.2,
            margin: "0 0 20px",
            maxWidth: 700,
            marginLeft: "auto",
            marginRight: "auto",
            color: DARK,
          }}
        >
          {t("land.heroTitle")}
          <br />
          <span style={{ color: PRIMARY }}>{t("land.heroAccent")}</span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "clamp(14px,2vw,18px)",
            color: "var(--text-main)",
            maxWidth: 540,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.8,
            marginBottom: 36,
          }}
        >
          {t("land.heroLine1")}
          <br />
          {t("land.heroLine2")}
          <span style={{ color: PRIMARY, fontWeight: 700 }}> {t("land.heroCta")}</span>
        </p>

        {/* CTA Buttons */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <Link
            to="/register"
            style={{
              display: "inline-block",
              padding: "15px 36px",
              borderRadius: 12,
              background: PRIMARY,
              color: "var(--bg-card)",
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 700,
              boxShadow: `0 6px 24px ${PRIMARY}40`,
              whiteSpace: "nowrap",
            }}
          >
            {t("land.ctaNoCard")}
          </Link>
          <Link
            to="/pricing"
            style={{
              display: "inline-block",
              padding: "15px 28px",
              borderRadius: 12,
              border: "2px solid var(--border-color)",
              color: "var(--text-main)",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
              background: "rgba(255,255,255,0.85)",
              whiteSpace: "nowrap",
            }}
          >
            {t("land.viewPricing")}
          </Link>
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
          {[
            t("land.check1"),
            t("land.check2"),
            t("land.check3"),
          ].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section style={{ background: DARK, padding: "32px clamp(16px,5vw,80px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
            gap: 24,
            maxWidth: 700,
            marginLeft: "auto",
            marginRight: "auto",
            textAlign: "center",
          }}
        >
          {[
            { num: "500+", label: t("land.stat1") },
            { num: "10K+", label: t("land.stat2") },
            { num: "98%", label: t("land.stat3") },
            { num: "24/7", label: t("land.stat4") },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: "clamp(22px,4vw,34px)", fontWeight: 900, color: PRIMARY }}>{s.num}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section style={{ padding: "clamp(50px,8vw,100px) clamp(16px,5vw,80px)", background: "var(--bg-app)" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.1em", marginBottom: 12 }}>FEATURES</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,38px)", fontWeight: 800, margin: "0 0 14px", color: DARK }}>
            {t("land.featuresTitle")}
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 16 }}>{t("land.featuresSub")}</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 20,
            maxWidth: 1000,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border-color)" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${PRIMARY}10`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  marginBottom: 16,
                }}
              >
                {f.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: DARK }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section style={{ padding: "clamp(50px,8vw,100px) clamp(16px,5vw,80px)", background: "var(--bg-card)" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, letterSpacing: "0.1em", marginBottom: 12 }}>PRICING</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,38px)", fontWeight: 800, margin: "0 0 12px", color: DARK }}>
            {t("land.pricingTitle")}
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 16 }}>{t("land.pricingSub")}</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: 20,
            maxWidth: 900,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: "var(--bg-card)",
                borderRadius: 20,
                padding: 28,
                border: plan.popular ? `2px solid ${plan.color}` : "1px solid #e2e8f0",
                position: "relative",
                boxShadow: plan.popular ? `0 8px 40px ${plan.color}25` : "none",
              }}
            >
              {plan.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: plan.color,
                    color: "var(--bg-card)",
                    padding: "4px 18px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("land.mostPopular")}
                </div>
              )}

              <div style={{ fontSize: 18, fontWeight: 800, color: plan.color, marginBottom: 6 }}>{plan.name}</div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 34, fontWeight: 900, color: DARK }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: 4 }}> {t("common.currency")} / {plan.period}</span>
              </div>

              <div style={{ marginBottom: 24 }}>
                {plan.features.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 0",
                      borderBottom: i < plan.features.length - 1 ? "1px solid #f1f5f9" : "none",
                      fontSize: 13,
                      color: "#374151",
                    }}
                  >
                    <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>

              <Link
                to="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "12px 0",
                  borderRadius: 10,
                  background: plan.popular ? plan.color : "transparent",
                  color: plan.popular ? "#fff" : plan.color,
                  border: `2px solid ${plan.color}`,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {plan.price === 0 ? t("land.startFreeShort") : t("land.startNow")}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section style={{ padding: "clamp(50px,8vw,100px) clamp(16px,5vw,80px)", background: "var(--bg-app)" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(20px,3vw,34px)", fontWeight: 800, margin: "0 0 12px", color: DARK }}>{t("land.faqTitle")}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>{t("land.faqSub")}</p>
        </div>

        <div style={{ maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={{
                marginBottom: 12,
                background: "var(--bg-card)",
                borderRadius: 14,
                border: "1px solid var(--border-color)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: "'Segoe UI',Tahoma,sans-serif",
                  textAlign: "right",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: DARK, flex: 1, textAlign: "right" }}>{faq.q}</span>
                <span
                  style={{
                    color: PRIMARY,
                    fontSize: 20,
                    flexShrink: 0,
                    display: "inline-block",
                    transform: openFaq === i ? "rotate(45deg)" : "rotate(0)",
                    transition: "transform 0.2s",
                  }}
                >
                  +
                </span>
              </button>
              {openFaq === i && (
                <div
                  style={{
                    padding: "0 20px 16px",
                    fontSize: 14,
                    color: "var(--text-muted)",
                    lineHeight: 1.7,
                    borderTop: "1px solid var(--border-color)",
                  }}
                >
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section
        style={{
          padding: "clamp(50px,8vw,100px) clamp(16px,5vw,80px)",
          background: `linear-gradient(135deg,${PRIMARY},#7c3aed)`,
          textAlign: "center",
          color: "var(--bg-card)",
        }}
      >
        <h2 style={{ fontSize: "clamp(22px,4vw,42px)", fontWeight: 900, margin: "0 0 16px" }}>{t("land.finalTitle")}</h2>
        <p
          style={{
            fontSize: "clamp(14px,2vw,18px)",
            opacity: 0.9,
            marginBottom: 32,
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {t("land.finalSub")}
        </p>
        <Link
          to="/register"
          style={{
            display: "inline-block",
            padding: "16px 44px",
            borderRadius: 12,
            background: "var(--bg-card)",
            color: PRIMARY,
            textDecoration: "none",
            fontSize: 16,
            fontWeight: 900,
            boxShadow: "0 6px 30px rgba(0,0,0,0.2)",
          }}
        >
          {t("land.finalCta")}
        </Link>
        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>Plateforme SaaS pour agences marketing en Algérie</div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer
        style={{
          background: DARK,
          padding: "28px clamp(16px,5vw,80px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏢</span>
          <span style={{ color: "var(--bg-card)", fontWeight: 700, fontSize: 14 }}>AgenceApp</span>
          <span style={{ color: "var(--text-main)", fontSize: 13 }}>© {new Date().getFullYear()} — {t("land.madeIn")}</span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { to: "/login", label: t("land.loginNav") },
            { to: "/register", label: t("land.registerNav") },
            { to: "/pricing", label: t("land.pricingNav") },
            { to: "/aide", label: t("common.help") },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              style={{
                color: "var(--text-muted)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

