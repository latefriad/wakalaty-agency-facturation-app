# Wakalaty

SaaS de facturation et de gestion pour agences (marketing, communication, prestation de services). Multi-tenant : chaque agence a ses propres données, cloisonnées par `agencyId`.

> 📥 Pour installer et lancer le projet en local (clone, dépendances, base de données), voir **[GUIDE-UTILISATION.md](./GUIDE-UTILISATION.md)** (français + arabe).
> 📄 Pour l'architecture technique détaillée (facturation, cron, variables d'env, déploiement), voir **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)**.

## Le projet en une phrase

Une agence s'inscrit, gère ses clients/contrats/employés, facture et se fait payer, suit sa trésorerie et son équipe — tout dans une seule appli web, avec une console super-admin pour piloter l'ensemble des agences abonnées.

## Fonctionnalités principales

**Facturation & clients**
- Factures et devis (numérotation légale séquentielle `FAC-2026-00042`), conversion devis → facture
- TVA par ligne, paiements partiels, statut retard automatique
- Factures récurrentes (mensuel/trimestriel/annuel), lien public de consultation client, PDF, relances d'impayés par e-mail, export CSV comptable
- Fiches clients, contrats, catalogue de services, fournisseurs

**Équipe & RH**
- Employés (salariés et freelances/commission), invitations par e-mail
- Congés, présence, managers, documents employés
- Tâches en mode Kanban (drag-and-drop), vues liste/calendrier, "Mon travail", assignation avec droits par rôle

**Pilotage**
- Cockpit financier (encaissé, facturé, trésorerie), budgets et prévisionnel de dépenses
- Portfolio (vitrine des réalisations de l'agence)
- Suggestions de services assistées par IA (optionnel, `OPENAI_API_KEY`)

**Plateforme**
- Rôles : SUPER_ADMIN (plateforme), ADMIN (agence), ACCOUNTANT, EMPLOYEE/EDITOR…
- Plans FREE/PRO/BUSINESS avec limites serveur, upgrade validé manuellement par le super-admin
- Console super-admin : gestion des agences, licences, abonnements

## Technologies utilisées

**Frontend** — `agence-facturation/`
- [React 19](https://react.dev/) (Create React App) + [React Router 7](https://reactrouter.com/)
- [Framer Motion](https://www.framer.com/motion/) (animations)
- [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) (génération PDF des factures)
- [Lucide React](https://lucide.dev/) (icônes), [React Hot Toast](https://react-hot-toast.com/) (notifications)
- [date-fns](https://date-fns.org/)
- Tests : Testing Library (React)

**Backend** — `backend/`
- [Node.js](https://nodejs.org/) (≥18) + [Express 4](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM 5](https://www.prisma.io/) (schéma, migrations versionnées)
- Auth : [JWT](https://github.com/auth0/node-jsonwebtoken) (`jsonwebtoken`) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) (hash des mots de passe)
- [Zod](https://zod.dev/) (validation des entrées)
- [Helmet](https://helmetjs.github.io/) + [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) (sécurité HTTP)
- [node-cron](https://github.com/node-cron/node-cron) (jobs planifiés : expiration abonnements, factures récurrentes, relances impayés)
- [Nodemailer](https://nodemailer.com/) (e-mails), [ExcelJS](https://github.com/exceljs/exceljs) (export), [Multer](https://github.com/expressjs/multer) (upload fichiers)
- Tests : [Jest](https://jestjs.io/) + [Supertest](https://github.com/ladjs/supertest)

**Infra & déploiement**
- Backend : [Render](https://render.com/) (`render.yaml`)
- Frontend : [Vercel](https://vercel.com/) (`vercel.json`)
- Docker Compose disponible pour PostgreSQL en local (`backend/docker-compose.yml`)

## Structure du dépôt

```
agence-facturation/   Frontend React (SPA)
backend/              API Express + Prisma
backend/prisma/       schema.prisma + migrations + scripts de seed
backend/src/modules/  Un dossier par domaine métier (invoices, clients, tasks, leaves,
                       budgets, suppliers, super-admin, ai, …)
```

## Comptes de test (base locale)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin (agence de démo) | `admin@wakalati.com` | `admin123` |
| Super-admin (`/super-admin`) | `beuvryclub@gmail.com` | `admin123` |

## Licence

Voir [LICENSING.md](./LICENSING.md).
