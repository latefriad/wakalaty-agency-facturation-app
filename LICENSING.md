# Système de licences Wakalaty

Wakalaty inclut un système de licences d'activation pour commercialiser le
logiciel. **Ton serveur (VPS Plesk) est l'autorité centrale** : toute
vérification est 100 % côté serveur, les licences sont signées Ed25519 et
révocables en temps réel.

> Ce système est **robuste, signé et révocable** — pas « incrackable ». Comme
> l'application tourne uniquement sur ton serveur (le client n'exécute rien
> localement), la vérification est de fait incontournable : elle est aussi
> solide que ton serveur lui-même.

---

## 1. Comment ça marche

1. **Tu vends** une licence à un client.
2. Dans le **back-office super-admin → 🔑 Licenses**, tu crées une licence
   (nom du client, plan, durée, nombre d'activations). Une **clé** de la forme
   `WKLY-XXXX-XXXX-XXXX-XXXX` s'affiche **une seule fois** — copie-la et
   transmets-la au client.
3. Le client, connecté en **ADMIN** de son agence, va dans
   **Réglages → 🔑 Licence**, colle la clé et l'active. Son plan est débloqué
   immédiatement.
4. À chaque requête, le serveur vérifie le statut de la licence de l'agence
   (cache 60 s). Si tu **révoques / suspends** la licence, l'accès de l'agence
   est bloqué en temps réel (le cache est purgé à l'action). Une licence
   **expirée** est tolérée pendant une courte **grace period** (72 h par
   défaut) avant blocage dur.

Les deux canaux **coexistent** : une agence sans licence continue d'utiliser le
flux d'abonnement classique (demande CCP + validation super-admin). La licence
est simplement un canal d'activation instantané.

### Pourquoi c'est infalsifiable

- La clé claire **n'est jamais stockée** : la base ne contient que son
  empreinte SHA-256. Un dump SQL ne révèle aucune clé activable.
- Chaque licence embarque un **payload signé Ed25519** (client, plan, expiry).
  À l'activation, le serveur **revérifie la signature**. Insérer une ligne
  frauduleuse en base ne suffit donc pas : sans la **clé privée** (qui ne vit
  qu'en variable d'environnement du serveur), le payload ne peut pas être
  signé, et l'activation est rejetée.
- Toutes les routes de gestion sont réservées au **super-admin** ; toutes les
  actions (création, activation, échecs d'activation, révocation…) sont
  **journalisées** dans l'audit log.

---

## 2. Générer la paire de clés Ed25519

Sur ton poste (ou directement sur le serveur), une seule fois :

```bash
cd backend
node scripts/generate-license-keypair.js
```

Le script imprime deux variables :

```
LICENSE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
LICENSE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

> ⚠️ La clé **PRIVÉE** est le secret qui rend les licences infalsifiables.
> Ne la commite **jamais**, ne la mets pas dans le dépôt, ne l'envoie à
> personne. Elle ne doit exister que dans les variables d'environnement du
> serveur. Si tu la perds, tu ne peux plus **émettre** de nouvelles licences
> (les licences déjà émises restent vérifiables tant que la clé **publique**
> ne change pas).

---

## 3. Variables d'environnement (Plesk → Node.js → Environment Variables)

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL | ✅ |
| `DIRECT_URL` | Connexion directe (migrations) | ✅ (= DATABASE_URL si non poolé) |
| `JWT_SECRET` | Signature des tokens d'auth (64+ caractères aléatoires) | ✅ |
| `FRONTEND_URL` | Origine CORS + liens publics | ✅ |
| `LICENSE_PRIVATE_KEY` | Clé privée Ed25519 (signe les licences) | ✅ pour émettre |
| `LICENSE_PUBLIC_KEY` | Clé publique Ed25519 (vérifie les licences) | ✅ pour activer |
| `LICENSE_GRACE_HOURS` | Tolérance après expiration avant blocage (défaut 72) | ⬜ |
| `NODE_ENV` | `production` | ✅ |
| `PORT` | Port du process Node (Plesk le fournit) | ⬜ |

> Si `LICENSE_PRIVATE_KEY` / `LICENSE_PUBLIC_KEY` sont absentes, le module
> licences se **désactive proprement** (le serveur démarre, l'activation
> renvoie une erreur explicite, aucun blocage n'est appliqué). C'est voulu :
> tu peux déployer avant d'activer la commercialisation.

---

## 4. Déploiement sur Plesk

1. **Base de données** : crée une base PostgreSQL dans Plesk, renseigne
   `DATABASE_URL` / `DIRECT_URL`.
2. **Variables d'env** : ajoute toutes les variables du tableau ci-dessus
   (dont la paire Ed25519).
3. **Application Node.js** (Plesk → Node.js) :
   - Application Root : `backend`
   - Application Startup File : `src/index.js`
   - Build : `npm install && npx prisma migrate deploy`
     (`migrate deploy` applique toutes les migrations, dont la table
     `licenses`, `license_activations` et `audit_logs`).
4. **Frontend** : build React (`cd agence-facturation && npm install && npm run
   build`) servi en statique, avec un reverse proxy Plesk qui route `/api/*`
   vers le process Node (port interne). `REACT_APP_API_URL` doit pointer vers
   `/api` (ou l'URL publique du backend).
5. **HTTPS** : active le certificat SSL/TLS Plesk (Let's Encrypt) sur le
   domaine et force la redirection `http → https`. La terminaison TLS est
   assurée par Plesk ; l'app fait déjà confiance au proxy (`trust proxy`).
6. **Créer le super-admin** : le rôle `SUPER_ADMIN` n'est pas assignable via
   l'API. Crée-le une fois en base (voir `prisma/seed.js` pour un exemple, ou
   un `UPDATE users SET role='SUPER_ADMIN' WHERE email='toi@exemple.com'`).

---

## 5. Rotation de la clé privée

Si la clé privée est compromise :

1. Génère une **nouvelle paire** (`generate-license-keypair.js`).
2. Remplace `LICENSE_PRIVATE_KEY` **et** `LICENSE_PUBLIC_KEY` dans Plesk, puis
   redémarre l'app.
3. **Attention** : les licences émises avec l'ancienne clé ne seront plus
   vérifiables (leur signature ne correspond plus à la nouvelle publique). Il
   faut **réémettre** les licences des clients actifs. Le binding d'agence en
   base est conservé, mais chaque client devra recoller sa nouvelle clé.

Pour éviter ce scénario : garde la privée uniquement dans Plesk, jamais
ailleurs.

---

## 6. Référence API

### Côté agence (auth ADMIN)
| Endpoint | Description |
|---|---|
| `POST /api/license/activate` `{licenseKey}` | Active une clé (rate-limité 10/15 min) |
| `GET /api/license/status` | Statut de la licence de l'agence (heartbeat) |

### Côté super-admin (auth SUPER_ADMIN)
| Endpoint | Description |
|---|---|
| `POST /api/license` | Créer une licence (renvoie la clé **une seule fois**) |
| `GET /api/license` | Lister (recherche `?search=`, filtre `?status=`) |
| `GET /api/license/:id` | Détail + activations |
| `PATCH /api/license/:id/status` `{action, reason}` | `suspend` / `reactivate` / `revoke` |
| `PATCH /api/license/:id` | Modifier notes / expiration / maxActivations |
| `DELETE /api/license/:id` | Supprimer |
| `GET /api/super-admin/audit-log` | Journal d'audit (filtres `?action=` `?targetId=`) |

---

## 7. Tests

```bash
cd backend && npm test
```

Couvre notamment : clé forgée rejetée, payload à signature invalide rejeté même
avec un hash valide en base, licence expirée bloquée, révocation effective
immédiate, binding `maxActivations`, et refus d'accès aux non-super-admins.
