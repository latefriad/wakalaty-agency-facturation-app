import { useState } from "react";
import { useLang } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { addService } from "../services/servicesService";

const SERVICE_TYPES = [
  "إدارة التواصل الاجتماعي",
  "تقييم جرافيك وإعلانات",
  "إدارة حملات الإعلانين",
  "تسويق وإنتاج محتوى",
  "تحسين محركات البحث SEO",
  "تطوير مواقع",
  "استراتيجيات تسويق",
  "أخرى",
];

const CATEGORY_FILTERS = [
  { value: "", label: "الكل" },
  { value: "إدارة التواصل الاجتماعي", label: "📱 التواصل الاجتماعي" },
  { value: "تصميم جرافيك", label: "🎨 تصميم جرافيك" },
  { value: "إعلانات", label: "📢 إعلانات" },
  { value: "محتوى", label: "🎬 محتوى" },
  { value: "SEO", label: "🔍 SEO" },
  { value: "تطوير مواقع", label: "💻 مواقع" },
  { value: "تسويق إلكتروني", label: "📧 تسويق إلكتروني" },
];

const BUILTIN_SERVICES = [
  { name: "إدارة صفحة فيسبوك الشهرية", type: "إدارة التواصل الاجتماعي", description: "إدارة شاملة لصفحة فيسبوك تشمل النشر اليومي والرد على التعليques والتفاعل مع الجمهور", suggestedPrice: 25000, features: ["نشر 12 منشور شهرياً","تصميم الصور والجرافيك","الرد على الرسائل والتعليقات","تقرير أداء شهري"] },
  { name: "إدارة إنستغرام الشهرية", type: "إدارة التواصل الاجتماعي", description: "إدارة حساب إنستغرام مع محتوى بصري جذاب وتفاعل مستمر مع المتابعين", suggestedPrice: 30000, features: ["نشر 15 منشور + Reels شهرياً","تصميم feed متناسق","إدارة Stories","تحليل النمو"] },
  { name: "إدارة تيك توك الشهرية", type: "إدارة التواصل الاجتماعي", description: "إنشاء وإدارة محتوى تيك توك إبداعي لزيادة الوعي والوصول", suggestedPrice: 35000, features: ["8 فيديوهات شهرياً","كتابة السكريبت","المونتاج الأساسي","استهداف الهاشتاغات"] },
  { name: "إدارة لينكدإن الشهرية", type: "إدارة التواصل الاجتماعي", description: "بناء الحضور المهني على لينكدإن للمشاريع B2B", suggestedPrice: 28000, features: ["5 منشورات أسبوعياً","بناء الشبكة المهنية","إدارة التعليقات","تقرير أسبوعي"] },
  { name: "تصميم الهوية البصرية", type: "تقييم جرافيك وإعلانات", description: "تصميم شعار + هوية بصرية كاملة تشمل الألوان والخطوط والعناصر البصرية", suggestedPrice: 50000, features: ["3 مقترحات شعار","دليل الهوية البصرية","ملفات PSD/AI","نسخ متعددة للشعار"] },
  { name: "تصميم المنشورات الاجتماعية", type: "تقييم جرافيك وإعلانات", description: "تصميم مجموعات منشورات احترافية لمنصات التواصل الاجتماعي", suggestedPrice: 15000, features: ["10 تصاميم شهرياً","تصميم موحد","ملفات قابلة للتعديل","بصيغ متعددة"] },
  { name: "تصميم البانرات الإعلانية", type: "تقييم جرافيك وإعلانات", description: "تصميم بانرات وإعلانات بصرية لمواقع الويب ووسائل التواصل", suggestedPrice: 12000, features: ["5 تصاميم","أحجام متعددة","ملفات PNG/JPG","تعديلات مجانية"] },
  { name: "تصميم عروض تقديمية", type: "تقييم جرافيك وإعلانات", description: "تصميم عروض تقديمية احترافية للشركات والعملاء", suggestedPrice: 15000, features: ["20 شريحة","تصميم عصري","رسوم متحركة","ملف PowerPoint/PDF"] },
  { name: "حملة إعلانات ميتا (فيسبوك + إنستغرام)", type: "إدارة حملات الإعلانين", description: "إدارة حملة إعلانات مدفوعة على منصة ميتا مع استهداف دقيق", suggestedPrice: 40000, features: ["إنشاء الحملة والاستهداف","إدارة الميزانية","A/B Testing","تقرير أداء أسبوعي"] },
  { name: "حملة إعلانات جوجل (Google Ads)", type: "إدارة حملات الإعلانين", description: "إدارة حملات البحث والdisplay على جوجل لإهداء العملاء المحتملين", suggestedPrice: 45000, features: ["بحث الكلمات المفتاحية","كتابة الإعلانات","إدارة الميزانية","تحسين الحملة مستمر"] },
  { name: "حملة إعلانات تيك توك", type: "إدارة حملات الإعلانين", description: "إطلاق حملات إعلانات مدفوعة على تيك توك للوصول لجمهور شبابي", suggestedPrice: 35000, features: ["تصميم الإعلانات","استهداف الجمهور","إدارة الميزانية","تقرير أسبوعي"] },
  { name: "إنتاج محتوى فيديو قصير", type: "تسويق وإنتاج محتوى", description: "إنتاج فيديوهات قصيرة احترافية لريلز وتيك توك وستوري", suggestedPrice: 20000, features: ["4 فيديوهات شهرياً","كتابة السكريبت","التصوير والمونتاج","موسيقى ترند"] },
  { name: "إنتاج محتوى يوتيوب", type: "تسويق وإنتاج محتوى", description: "إنتاج فيديوهات يوتيوب كاملة من الكتابة إلى المونتاج والنشر", suggestedPrice: 60000, features: ["سكريبت احترافي","تصوير + مونتاج","تصميم الصورة المصغرة","SEO لليوتيوب"] },
  { name: "كتابة المقالات والمحتوى النصي", type: "تسويق وإنتاج محتوى", description: "كتابة مقالات SEO ونصوص إعلانية تسويقية بأعلى جودة", suggestedPrice: 10000, features: ["8 مقالات شهرياً","بحث الكلمات المفتاحية","محتوى أصلي 100%","تنسيق احترافي"] },
  { name: "حملة تسويق بالبريد الإلكتروني", type: "تسويق وإنتاج محتوى", description: "تصميم وإرسال حملات بريد إلكتروني احترافية للعملاء", suggestedPrice: 18000, features: ["تصميم القالب","قاعدة بيانات مستهدفة","أتمتة الإرسال","تحليل النتائج"] },
  { name: "تحسين SEO للموقع الإلكتروني", type: "تحسين محركات البحث SEO", description: "تحسين ترتيب الموقع في نتائج البحث مع تحسين تقني ومضموني", suggestedPrice: 40000, features: ["تحليل الموقع الكامل","تحسين التقنيات","بناء الروابط الخلفية","تقرير شهري"] },
  { name: "تحسين SEO المحلي", type: "تحسين محركات البحث SEO", description: "تحسين حضورك في نتائج البحث المحلية وجوجل ماب", suggestedPrice: 25000, features: ["تحسين Google Business","إدارة التقييمات","Local SEO","تقرير شهري"] },
  { name: "تطوير موقع ويب تعريفي", type: "تطوير مواقع", description: "تصميم وتطوير موقع ويب تعريفي احترافي متجاوب مع كل الأجهزة", suggestedPrice: 80000, features: ["تصميم عصري","متجاوب مع الأجهزة","لوحة تحكم بسيطة","شهادة SSL"] },
  { name: "تطوير متجر إلكتروني", type: "تطوير مواقع", description: "بناء متجر إلكتروني كامل مع نظام الدفع وإدارة المنتجات", suggestedPrice: 150000, features: ["تصميم المنتجات","نظام سلة المشتريات","بوابة الدفع","إدارة المخزون"] },
  { name: "تصميم واجهة المستخدم UI/UX", type: "تطوير مواقع", description: "تصميم تجربة المستخدم واجهة المستخدم لتطبيقات والمواقع", suggestedPrice: 70000, features: ["بحث المستخدمين","Wireframes","تصميم تفاعلي","اختبار الاستخدام"] },
  { name: "إدارة المجتمع الإلكتروني", type: "إدارة التواصل الاجتماعي", description: "إنشاء وإدارة مجتمع أو جروب مخصص لتفاعل العملاء والمعجبين", suggestedPrice: 22000, features: ["إنشاء المجتمع","محتوى حصري أسبوعي","إدارة الأحداث","تفاعل مستمر"] },
  { name: "تقرير التسويق الرقمي الشامل", type: "استراتيجيات تسويق", description: "تحليل شامل لجميع قنواتك الرقمية مع توصيات لتحسين الأداء", suggestedPrice: 15000, features: ["تحليل شامل","مقارنة المنافسين","توصيات عملية","خطة عمل شهرية"] },
  { name: "استشارة تسويقية شهرية", type: "استراتيجيات تسويق", description: "جلسة استشارية شهرية مع خبير تسويق لوضع خطة تسويقية فعّالة", suggestedPrice: 20000, features: ["جلسة شهرية 60 دقيقة","تحليل السوق","خطة تسويقية","متابعة التنفيذ"] },
  { name: "إدارة حملة Influencer Marketing", type: "استراتيجيات تسويق", description: "التنسيق مع المؤثرين وإدارة الحملات التسويقية بالتأثير", suggestedPrice: 50000, features: ["اختيار المؤثرين","التفاوض والتنسيق","متابعة الحملة","قياس النتائج"] },
  { name: "خدمة إدارة محتوى الشبكات الاجتماعية", type: "إدارة التواصل الاجتماعي", description: "إدارة شاملة لجميع حسابات التواصل مع جدول نشر منتظم", suggestedPrice: 45000, features: ["4 منصات","جدول نشر شهري","تصميم المحتوى","التفاعل اليومي"] },
];

export default function ServiceProposals() {
  const { t } = useLang();
  const { agencyId } = useAuth();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [filter, setFilter] = useState("");
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setGenerated(false);
    try {
      let result = BUILTIN_SERVICES;
      if (filter) {
        result = result.filter((sv) => sv.type && sv.type.includes(filter));
      }
      // Simulate loading delay for UX
      await new Promise((r) => setTimeout(r, 800));
      setServices(result);
      setSelected(new Set());
      setGenerated(true);
    } catch (err) {
      setError(err.message || "Failed to generate services");
    }
    setLoading(false);
  };

  const toggleSelect = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === services.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(services.map((_, i) => i)));
    }
  };

  const handleAddSelected = async () => {
    if (selected.size === 0 || !agencyId) return;
    setAdding(true);
    try {
      for (const idx of selected) {
        const sv = services[idx];
        const typeMatch = SERVICE_TYPES.find((t) => sv.type && sv.type.includes(t));
        await addService(agencyId, {
          name: sv.name,
          type: typeMatch || sv.type || "أخرى",
          salePrice: sv.suggestedPrice || 0,
          charges: [{ label: "أخرى", amount: 0 }],
          totalCharges: 0,
          netProfit: sv.suggestedPrice || 0,
          notes: sv.description || "",
          features: sv.features || [],
          fromAI: true,
        });
      }
      setAdded(true);
      setTimeout(() => {
        setAdded(false);
        setSelected(new Set());
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to add services");
    }
    setAdding(false);
  };

  const filtered = filter
    ? services.filter((sv) => sv.type && sv.type.includes(filter))
    : services;

  return (
    <div style={{ direction: "inherit", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {t("prop.pageTitle")}
          </h1>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
            {t("prop.pageSubtitle")}
          </p>
        </div>
      </div>

      {/* Generate Controls */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 20,
          border: "1px solid #e2e8f0",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
                color: "#374151",
              }}
            >
              {t("prop.filterByCategory")}
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              {CATEGORY_FILTERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              background: loading ? "#94a3b8" : "#8b5cf6",
              color: "#fff",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "'Segoe UI', Tahoma, sans-serif",
              whiteSpace: "nowrap",
              marginTop: 22,
            }}
          >
            {loading ? (
              <span>{t("prop.aiGenerating")}</span>
            ) : (
              <span>{t("prop.aiGenerate")}</span>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "#fef2f2",
            color: "#dc2626",
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <div style={{ color: "#8b5cf6", fontSize: 16, fontWeight: 600 }}>
            {t("prop.generatingLong")}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
            {t("prop.fewSeconds")}
          </div>
        </div>
      )}

      {/* Results Header */}
      {generated && !loading && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, color: "#64748b" }}>
            {t("prop.generatedCount")} <strong>{filtered.length}</strong> {t("prop.servicesWord")}
            {selected.size > 0 && (
              <span style={{ marginRight: 12, color: "#8b5cf6" }}>
                — {selected.size} {t("prop.selectedCount")}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={selectAll}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "'Segoe UI', Tahoma, sans-serif",
              }}
            >
              {selected.size === filtered.length ? t("prop.deselectAll") : t("prop.selectAll")}
            </button>

            {selected.size > 0 && (
              <button
                onClick={handleAddSelected}
                disabled={adding}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  background: added ? "#10b981" : "#3b82f6",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: "'Segoe UI', Tahoma, sans-serif",
                }}
              >
                {adding
                  ? t("prop.adding")
                  : added
                  ? t("prop.addedN", { n: selected.size })
                  : t("prop.addN", { n: selected.size })}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Service Cards Grid */}
      {generated && !loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((sv, idx) => {
            const isSelected = selected.has(idx);
            return (
              <div
                key={idx}
                onClick={() => toggleSelect(idx)}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 20,
                  border: `2px solid ${isSelected ? "#8b5cf6" : "#e2e8f0"}`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  position: "relative",
                }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `2px solid ${isSelected ? "#8b5cf6" : "#cbd5e1"}`,
                    background: isSelected ? "#8b5cf6" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {isSelected && "✓"}
                </div>

                {/* Type Badge */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: "#f1f5f9",
                    color: "#64748b",
                    display: "inline-block",
                    marginBottom: 10,
                  }}
                >
                  {sv.type}
                </div>

                {/* Name */}
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    margin: "0 0 8px",
                    color: "#1e293b",
                    paddingRight: 28,
                  }}
                >
                  {sv.name}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    margin: "0 0 12px",
                    lineHeight: 1.6,
                  }}
                >
                  {sv.description}
                </p>

                {/* Features */}
                {sv.features && sv.features.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {sv.features.slice(0, 4).map((f, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 12,
                          color: "#374151",
                          padding: "2px 0",
                        }}
                      >
                        ✅ {f}
                      </div>
                    ))}
                    {sv.features.length > 4 && (
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        +{sv.features.length - 4} {t("prop.moreFeatures")}
                      </div>
                    )}
                  </div>
                )}

                {/* Price */}
                <div
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    💰 {t("prop.suggestedPrice")}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#3b82f6",
                    }}
                  >
                    {(sv.suggestedPrice || 0).toLocaleString("ar-DZ")} {t("common.currency")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {generated && !loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div>{t("prop.noResultsCategory")}</div>
        </div>
      )}

      {/* Initial State */}
      {!generated && !loading && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
            {t("prop.emptyTitle")}
          </div>
          <div style={{ fontSize: 13, maxWidth: 400, margin: "0 auto", lineHeight: 1.8 }}>
            {t("prop.emptyBody")}
          </div>
        </div>
      )}
    </div>
  );
}
