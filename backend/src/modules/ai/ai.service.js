const prisma = require("../../config/database");
const config = require("../../config/env");

const DIGITAL_SERVICES = [
  { name: "Gestion page Facebook mensuelle", type: "Social Media", description: "Gestion complète de page Facebook", suggestedPrice: 25000, features: ["12 publications/mois", "Design graphique", "Réponses commentaires", "Rapport mensuel"] },
  { name: "Gestion Instagram mensuelle", type: "Social Media", description: "Gestion complète Instagram avec contenu visuel", suggestedPrice: 30000, features: ["15 posts + Reels/mois", "Feed cohérent", "Stories", "Analyse croissance"] },
  { name: "Gestion TikTok mensuelle", type: "Social Media", description: "Création de contenu TikTok créatif", suggestedPrice: 35000, features: ["8 vidéos/mois", "Script", "Montage basique", "Hashtags trending"] },
  { name: "Identité visuelle complète", type: "Design & Graphisme", description: "Logo + charte graphique complète", suggestedPrice: 50000, features: ["3 propositions logo", "Guide identité", "Fichiers PSD/AI", "Versions multiples"] },
  { name: "Design publications sociales", type: "Design & Graphisme", description: "Ensemble de posts professionnels", suggestedPrice: 15000, features: ["10 designs/mois", "Design uniforme", "Fichiers modifiables", "Multi-formats"] },
  { name: "Campagne Meta Ads (FB + IG)", type: "Publicité", description: "Gestion campagne publicitaire Meta ciblée", suggestedPrice: 40000, features: ["Création campagne", "Gestion budget", "A/B Testing", "Rapport hebdo"] },
  { name: "Campagne Google Ads", type: "Publicité", description: "Campagnes Search & Display Google", suggestedPrice: 45000, features: ["Recherche mots-clés", "Rédaction annonces", "Optimisation continue", "Rapport mensuel"] },
  { name: "Production vidéo courte", type: "Production vidéo", description: "Vidéos courtes pour Reels/TikTok/Stories", suggestedPrice: 20000, features: ["4 vidéos/mois", "Script", "Tournage + montage", "Musique trending"] },
  { name: "Rédaction articles SEO", type: "Content Marketing", description: "Articles SEO et textes marketing", suggestedPrice: 10000, features: ["8 articles/mois", "Recherche mots-clés", "Contenu original", "Formatage pro"] },
  { name: "Optimisation SEO site web", type: "SEO", description: "Optimisation technique et contenu pour SEO", suggestedPrice: 40000, features: ["Audit complet", "Optimisation technique", "Netlinking", "Rapport mensuel"] },
  { name: "Développement site vitrine", type: "Développement Web", description: "Site web responsive professionnel", suggestedPrice: 80000, features: ["Design moderne", "Responsive", "CMS intégré", "Certificat SSL"] },
  { name: "Développement e-commerce", type: "Développement Web", description: "Boutique en ligne complète avec paiement", suggestedPrice: 150000, features: ["Catalogue produits", "Panier", "Paiement", "Gestion stock"] },
  { name: "Campagne email marketing", type: "Content Marketing", description: "Campagnes email professionnelles", suggestedPrice: 18000, features: ["Design template", "Base ciblée", "Automatisation", "Analyse résultats"] },
  { name: "Stratégie marketing digitale", type: "Stratégie", description: "Audit + plan marketing digital complet", suggestedPrice: 30000, features: ["Audit complet", "Analyse concurrence", "Plan d'action", "Recommandations"] },
  { name: "Consultation marketing mensuelle", type: "Stratégie", description: "Séance consultative mensuelle", suggestedPrice: 20000, features: ["Séance 60min", "Analyse marché", "Plan marketing", "Suivi"] },
];

async function generateServices(category) {
  if (config.OPENAI_API_KEY) {
    try {
      const OpenAI = require("openai");
      const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Tu es expert en marketing digital. Voici une liste de services: ${JSON.stringify(DIGITAL_SERVICES.slice(0, 10))}. Génère une liste de 20 services digitaux en français. Format JSON array: name, type, description, suggestedPrice (en DA), features (array).`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      let content = completion.choices[0].message.content.trim();
      content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      const services = JSON.parse(content);
      return { services, source: "ai" };
    } catch (err) {
      console.error("OpenAI error:", err.message);
    }
  }

  let services = DIGITAL_SERVICES;
  if (category) {
    services = services.filter((s) => s.type && s.type.includes(category));
  }
  return { services, source: "builtin" };
}

module.exports = { generateServices };
