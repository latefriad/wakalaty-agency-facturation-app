# Wakalaty — SaaS de facturation pour agences

## Architecture

```
agence-facturation/   React 19 (CRA) — déployé sur Vercel
backend/              Express + Prisma + PostgreSQL — déployé sur Render
backend/prisma/       Schéma + migrations versionnées (prisma migrate deploy)
```

- **Auth** : JWT (7 j) signé par le backend, stocké côté front (`wakalati_token`).
- **Multi-tenant** : chaque table porte `agencyId` ; toutes les requêtes filtrent
  par l'agence du token, y compris les références croisées (clientId, serviceIds…).
- **Rôles** : SUPER_ADMIN (plateforme), ADMIN (agence), ACCOUNTANT (facturation),
  EMPLOYEE/EDITOR/… (espace employé). `authorize()` sur chaque écriture.
- **Plans** : FREE/PRO/BUSINESS. Limites appliquées côté serveur (`planGuard`).
  Upgrade = demande PENDING (paiement manuel CCP) approuvée par le SUPER_ADMIN.
  Expiration automatique par cron (retour à FREE).

## Facturation

- Numérotation séquentielle légale par agence/année : `FAC-2026-00042`,
  `DEV-2026-00007` (compteur Postgres atomique, jamais modifiable).
- Devis (`docType: DEVIS`) convertibles en facture (traçabilité `convertedFromId`).
- TVA par ligne (`taxRate`) avec héritage ligne > facture > client (`defaultTaxRate`).
  Totaux (HT/TVA/TTC) calculés et stockés côté serveur.
- Paiements partiels (`Payment.invoiceId`), passage PAYEE automatique, statut
  EN_RETARD calculé sur l'échéance.
- Factures récurrentes (mensuel/trimestriel/annuel) générées par cron.
- PDF téléchargeable côté client (jspdf + html2canvas), 3 templates.
- Lien public par facture (`/f/:token`) : le client consulte/télécharge sans compte.
- E-mail au client + relances d'impayés automatiques (cron 09:00, 1 relance/3 j,
  opt-out par agence).
- Export CSV comptable (`GET /api/invoices/export/csv`).

## Jobs cron (dans le process backend)

| Heure | Job |
|---|---|
| 02:00 | Expiration des abonnements (agence → FREE) |
| 06:00 | Génération des factures récurrentes |
| 09:00 | Relances d'impayés par e-mail |

Une passe de rattrapage tourne au démarrage (Render free s'endort).

## Lancer en local

```bash
# 1. PostgreSQL
docker compose -f backend/docker-compose.yml up -d db

# 2. Backend (port 4000)
cd backend && cp .env.example .env && npm install
npx prisma migrate deploy && node prisma/seed.js
npm start

# 3. Frontend (port 3000)
cd agence-facturation && cp .env.example .env && npm install
npm start
```

Compte de démo (seed) : `admin@wakalati.com` / `admin123`.

Compte super-admin (console `/super-admin`) : `beuvryclub@gmail.com` / `admin123`
(recréé/réinitialisé via `node backend/scripts/create-super-admin.js beuvryclub@gmail.com "Nariman" admin123`).

## Variables d'environnement backend

| Variable | Rôle |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Auth |
| `FRONTEND_URL` | CORS + liens publics dans les e-mails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | E-mails (optionnel — sans eux, envoi désactivé proprement) |
| `OPENAI_API_KEY` | Suggestions de services (optionnel) |

## Déploiement

- **Backend (Render)** : `render.yaml` — penser à `npx prisma migrate deploy`
  au build (`buildCommand: npm install && npx prisma migrate deploy`).
- **Frontend (Vercel)** : `vercel.json` racine — SPA statique, l'API vit sur Render.
- Webhooks/Stripe : non utilisés. Le paiement des abonnements est manuel
  (CCP/virement) avec validation super-admin.

## Tests

```bash
cd backend && npm test   # jest + supertest (auth, isolation tenant, plans, numérotation)
```
