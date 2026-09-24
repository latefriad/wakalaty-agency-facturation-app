import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";

const AGENCY_TYPES = ["ob.type1", "ob.type2", "ob.type3", "ob.type4", "ob.type5", "ob.type6"];

const TEAM_SIZES = [
  { key: "ob.teamSolo", value: "1" },
  { key: "ob.teamSmall", value: "2-5" },
  { key: null, label: "6-10", value: "6-10" },
  { key: null, label: "+10", value: "10+" },
];

const GOALS = ["ob.goal1", "ob.goal2", "ob.goal3", "ob.goal4", "ob.goal5", "ob.goal6"];

export default function Onboarding() {
  const { t } = useLang();
  const { updateAgency, agency } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState({
    agencyType: "",
    teamSize: "",
    goals: [],
    primaryColor: agency?.primaryColor || "#3b82f6",
  });

  const TOTAL_STEPS = 4;
  const progress = Math.round((step / TOTAL_STEPS) * 100);

  const toggleGoal = (g) =>
    setData((d) => ({
      ...d,
      goals: d.goals.includes(g) ? d.goals.filter((x) => x !== g) : [...d.goals, g],
    }));

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateAgency({
        agencyType: data.agencyType,
        teamSize: data.teamSize,
        goals: data.goals,
        primaryColor: data.primaryColor,
        onboarded: true,
      });
      navigate("/dashboard");
    } catch (err) {
      console.error("Onboarding save error:", err);
      navigate("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  const COLORS = [
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${data.primaryColor}11, ${data.primaryColor}22)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        direction: "inherit",
        fontFamily: "'Segoe UI',Tahoma,sans-serif",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 24,
          padding: "clamp(24px,5vw,40px)",
          width: "100%",
          maxWidth: 520,
          boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
        }}
      >
        {/* Progress */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            <span>
              {t("ob.stepOf", { step, total: TOTAL_STEPS })}
            </span>
            <span>{progress}%</span>
          </div>
          <div style={{ background: "var(--bg-hover)", borderRadius: 99, height: 6 }}>
            <div
              style={{
                width: `${progress}%`,
                height: 6,
                borderRadius: 99,
                background: data.primaryColor,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Step 1 - Agency Type */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{t("ob.welcome")}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("ob.agencyType")}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {AGENCY_TYPES.map((ty) => (
                <button
                  key={ty}
                  onClick={() => setData((d) => ({ ...d, agencyType: ty }))}
                  style={{
                    padding: "12px 10px",
                    borderRadius: 10,
                    border: `2px solid ${data.agencyType === ty ? data.primaryColor : "var(--border-color)"}`,
                    background: data.agencyType === ty ? `${data.primaryColor}11` : "var(--bg-card)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: data.agencyType === ty ? 600 : 400,
                    color: data.agencyType === ty ? data.primaryColor : "var(--text-main)",
                    transition: "all 0.2s",
                    fontFamily: "'Segoe UI',Tahoma,sans-serif",
                  }}
                >
                  {t(ty)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 - Team Size */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{t("ob.teamSize")}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("ob.teamSizeSub")}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {TEAM_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setData((d) => ({ ...d, teamSize: s.value }))}
                  style={{
                    padding: "20px 10px",
                    borderRadius: 12,
                    border: `2px solid ${data.teamSize === s.value ? data.primaryColor : "var(--border-color)"}`,
                    background: data.teamSize === s.value ? `${data.primaryColor}11` : "var(--bg-card)",
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 600,
                    color: data.teamSize === s.value ? data.primaryColor : "var(--text-main)",
                    fontFamily: "'Segoe UI',Tahoma,sans-serif",
                  }}
                >
                  {s.key ? t(s.key) : s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 - Goals */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{t("ob.goals")}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("ob.goalsSub")}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGoal(g)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: `2px solid ${data.goals.includes(g) ? data.primaryColor : "var(--border-color)"}`,
                    background: data.goals.includes(g) ? `${data.primaryColor}11` : "var(--bg-card)",
                    cursor: "pointer",
                    fontSize: 13,
                    textAlign: "right",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: data.goals.includes(g) ? data.primaryColor : "var(--text-main)",
                    fontWeight: data.goals.includes(g) ? 600 : 400,
                    fontFamily: "'Segoe UI',Tahoma,sans-serif",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{data.goals.includes(g) ? "✅" : "⬜"}</span>
                  {t(g)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 - Color */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{t("ob.pickColor")}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("ob.pickColorSub")}</p>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              {COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => setData((d) => ({ ...d, primaryColor: c }))}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: c,
                    cursor: "pointer",
                    border: data.primaryColor === c ? "4px solid #1e293b" : "3px solid transparent",
                    transform: data.primaryColor === c ? "scale(1.15)" : "scale(1)",
                    transition: "all 0.2s",
                  }}
                />
              ))}
            </div>

            {/* Preview */}
            <div
              style={{
                background: `linear-gradient(135deg, ${data.primaryColor},${data.primaryColor}99)`,
                borderRadius: 14,
                padding: 20,
                color: "var(--bg-card)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700 }}>{agency?.name || t("ob.yourAgency")} 🏢</div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{t("ob.previewHint")}</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: 10,
                background: "var(--bg-hover)",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "'Segoe UI',Tahoma,sans-serif",
              }}
            >
              ← {t("auth.back")}
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              style={{
                flex: 2,
                padding: "12px 0",
                borderRadius: 10,
                background: data.primaryColor,
                color: "var(--bg-card)",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'Segoe UI',Tahoma,sans-serif",
              }}
            >
              {t("auth.next")}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              style={{
                flex: 2,
                padding: "12px 0",
                borderRadius: 10,
                background: data.primaryColor,
                color: "var(--bg-card)",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'Segoe UI',Tahoma,sans-serif",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? t("ob.settingUp") : t("ob.startNow")}
            </button>
          )}
        </div>

        {/* Skip */}
        {step < TOTAL_STEPS && (
          <button
            onClick={() => {
              updateAgency({ onboarded: true }).catch(console.error);
              navigate("/dashboard");
            }}
            style={{
              width: "100%",
              marginTop: 12,
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 13,
              padding: "8px 0",
              fontFamily: "'Segoe UI',Tahoma,sans-serif",
            }}
          >
            {t("ob.skip")}
          </button>
        )}
      </div>
    </div>
  );
}

