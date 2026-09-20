import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { Link } from "react-router-dom";

export default function Register() {
  const { t } = useLang();
  const { registerAgency } = useAuth();
  const [step, setStep]    = useState(1);
  const [form, setForm]    = useState({
    agencyName:"", ownerName:"", email:"", password:"", confirmPassword:""
  });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const upd = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    if (form.password !== form.confirmPassword)
      return setError(t("auth.passwordMismatch"));
    if (form.password.length < 6)
      return setError(t("auth.passwordTooShort"));
    setError(""); setLoading(true);
    try {
      await registerAgency({
        agencyName: form.agencyName, ownerName: form.ownerName,
        email: form.email, password: form.password,
      });
    } catch (err) {
      setError(err.code === "auth/email-already-in-use"
        ? t("auth.emailTaken")
        : t("common.error") + ": " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", direction:"inherit",
      background:"linear-gradient(135deg, #3b82f611, #6366f122)",
      fontFamily:"'Segoe UI', Tahoma, sans-serif", padding:20
    }}>
      <div style={{
        background:"#fff", borderRadius:20,
        padding:"clamp(24px,5vw,40px)",
        width:"100%", maxWidth:440,
        boxShadow:"0 20px 60px rgba(0,0,0,0.1)", border:"1px solid #e2e8f0"
      }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{
            width:60, height:60, borderRadius:16, margin:"0 auto 10px",
            background:"linear-gradient(135deg,#3b82f6,#6366f1)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:26
          }}>🏢</div>
          <h1 style={{ fontSize:"clamp(18px,4vw,22px)", fontWeight:700, margin:0 }}>
            {t("auth.registerTitle")}
          </h1>
          <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>
            {t("auth.registerSubtitle")}
          </p>
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:24 }}>
          {[1,2].map(s => (
            <div key={s} style={{ flex:1, height:5, borderRadius:3,
              background: step >= s ? "#3b82f6":"#e2e8f0", transition:"background 0.3s" }}/>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              {[
                { label:"🏢 " + t("auth.agencyNameLabel"), key:"agencyName", ph:t("auth.agencyNamePlaceholder") },
                { label:"👤 " + t("auth.ownerNameLabel"), key:"ownerName",  ph:t("clients.namePlaceholder") },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={{ display:"block", fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                  <input value={form[f.key]} onChange={e => upd(f.key, e.target.value)}
                    placeholder={f.ph} required
                    style={{ width:"100%", padding:"11px 14px", borderRadius:9,
                      border:"1px solid #e2e8f0", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              {[
                { label:"📧 " + t("auth.emailLabel"), key:"email",           type:"email",    ph:"admin@agence.com" },
                { label:"🔒 " + t("auth.passwordLabel"),        key:"password",        type:"password", ph:t("auth.passwordTooShort") },
                { label:"🔒 " + t("auth.confirmPasswordLabel"),  key:"confirmPassword", type:"password", ph:"••••••••" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={{ display:"block", fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]}
                    onChange={e => upd(f.key, e.target.value)}
                    placeholder={f.ph} required
                    style={{ width:"100%", padding:"11px 14px", borderRadius:9,
                      border:"1px solid #e2e8f0", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
                </div>
              ))}
              {error && (
                <div style={{ background:"#fee2e2", color:"#dc2626", padding:"10px",
                  borderRadius:8, fontSize:13, marginBottom:14, textAlign:"center" }}>❌ {error}</div>
              )}
            </>
          )}

          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)} style={{
                flex:1, padding:"12px 0", borderRadius:10,
                background:"#f1f5f9", border:"none", cursor:"pointer", fontSize:14
              }}>← {t("auth.back")}</button>
            )}
            <button type="submit" disabled={loading} style={{
              flex:2, padding:"12px 0", borderRadius:10,
              background:"#3b82f6", color:"#fff", border:"none",
              cursor:"pointer", fontWeight:700, fontSize:15,
              opacity: loading ? 0.7 : 1
            }}>
              {loading ? t("auth.creating") : step===1 ? t("auth.next") : "🚀 " + t("auth.createAccount")}
            </button>
          </div>
        </form>

        <p style={{ textAlign:"center", color:"#64748b", fontSize:13, margin:0 }}>
          {t("auth.alreadyAccount")}{" "}
          <Link to="/login" style={{ color:"#3b82f6", fontWeight:600, textDecoration:"none" }}>
            {t("auth.doLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}

