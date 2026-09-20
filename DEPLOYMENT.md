# Déploiement — wakalati.app (VPS Plesk)

Guide complet pour mettre Wakalaty en production sur ton VPS Plesk, sous le
domaine **`wakalati.app`**.

**Architecture cible : un seul domaine.**
- `https://wakalati.app` sert le **frontend** React (fichiers statiques).
- `https://wakalati.app/api/*` est **reverse-proxifié** vers le backend Node
  (Express) qui tourne en interne sur un port local.
- Même origine → pas de souci CORS, le front appelle `/api` en relatif.

---

## 0. Prérequis

- Un VPS avec Plesk, extension **Node.js** installée (Plesk → Extensions).
- Le domaine `wakalati.app` pointant vers l'IP du VPS (enregistrements DNS
  A `@` et `www` → IP du serveur).
- Une base **PostgreSQL** (Plesk → Bases de données, ou un Postgres géré).

---

## 1. Récupérer le code

Dans le répertoire du domaine (ex. `/var/www/vhosts/wakalati.app/`) :

```bash
git clone git@github.com:Dr-nor/wakalaty-agency-facturation-app.git app
cd app
```

Structure : `app/backend` (API Node) et `app/agence-facturation` (front React).

---

## 2. Générer les secrets (une fois)

```bash
cd backend

# 1) Secret JWT (64 caractères aléatoires)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 2) Paire de clés de licence Ed25519
node scripts/generate-license-keypair.js
```

Garde ces valeurs pour l'étape suivante. **La clé privée de licence et le
secret JWT ne doivent jamais être commités ni partagés.**

---

## 3. Backend — application Node.js dans Plesk

Plesk → domaine `wakalati.app` → **Node.js** :

| Champ | Valeur |
|---|---|
| Node.js version | 18 ou supérieur |
| Application Root | `app/backend` |
| Application Startup File | `src/index.js` |
| Application Mode | `production` |

**Variables d'environnement** (bouton « Custom environment variables ») :

```
DATABASE_URL       = postgresql://USER:PASS@localhost:5432/wakalati   # ⚠️ vérifiez le port (souvent 5433 sur Plesk) : ss -lntp | grep postgres
DIRECT_URL         = postgresql://USER:PASS@localhost:5432/wakalati   # même port que ci-dessus
JWT_SECRET         = <le secret généré à l'étape 2>
JWT_EXPIRES_IN     = 7d
NODE_ENV           = production
FRONTEND_URL       = https://wakalati.app,https://www.wakalati.app
LICENSE_PRIVATE_KEY= <clé privée Ed25519 de l'étape 2>
LICENSE_PUBLIC_KEY = <clé publique Ed25519 de l'étape 2>
LICENSE_GRACE_HOURS= 72
```

Optionnel (e-mails : envoi de factures + relances d'impayés). Sans ça, l'envoi
est simplement désactivé.

```
SMTP_HOST = smtp.brevo.com
SMTP_PORT = 587
SMTP_USER = <identifiant SMTP>
SMTP_PASS = <mot de passe SMTP>
MAIL_FROM = "Wakalaty <no-reply@wakalati.app>"
```

Puis, dans l'onglet Node.js :
1. **NPM install** (bouton) — installe les dépendances.
2. **Run script** → `prisma migrate deploy` (applique toutes les migrations,
   crée les tables licences/audit incluses). Ou en SSH :
   ```bash
   cd app/backend && npx prisma migrate deploy
   ```
3. **Restart App**.

> Le port interne est géré par Plesk (variable `PORT` injectée). Ne le fixe pas
> toi-même.

---

## 4. Reverse proxy `/api` → backend

Pour que `https://wakalati.app/api` atteigne le process Node, ajoute une règle
Apache/nginx. Plesk → domaine → **Apache & nginx Settings** →
« Additional nginx directives » :

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:PORT_NODE/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location /uploads/ {
    proxy_pass http://127.0.0.1:PORT_NODE/uploads/;
}
```

Remplace `PORT_NODE` par le port affiché dans l'onglet Node.js de Plesk.
L'app fait déjà `trust proxy` → le rate-limit et les IP d'audit fonctionnent
correctement derrière ce proxy.

---

## 5. Frontend — build statique

```bash
cd app/agence-facturation
npm install
npm run build   # lit .env.production → REACT_APP_API_URL=/api
```

Le build est généré dans `agence-facturation/build`. Deux options pour le
servir sous `wakalati.app` :

- **Simple** : définis la racine du document du domaine (Plesk → Hosting
  Settings → Document Root) sur `app/agence-facturation/build`.
- **Ou** copie le contenu de `build/` dans le dossier web du domaine
  (ex. `httpdocs/`).

**SPA fallback** (React Router) — toutes les routes doivent renvoyer
`index.html`. Ajoute dans les directives nginx :

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Grâce à cette règle, les fichiers statiques comme le manuel client
(`/manuel.html`) sont servis directement, tandis que les routes de
l'application (dont `/aide`, qui affiche le manuel) retombent sur `index.html`
et sont gérées par React.

---

## 6. HTTPS

Plesk → domaine → **SSL/TLS Certificates** → installe un certificat
**Let's Encrypt** pour `wakalati.app` **et** `www.wakalati.app`, puis active
**« Redirect from http to https »**. La terminaison TLS est faite par Plesk ;
le backend n'a rien à configurer.

---

## 7. Créer le premier super-admin

Le rôle super-admin n'est pas créable via l'API. En SSH :

```bash
cd app/backend
node scripts/create-super-admin.js admin@wakalati.app "Ton Nom" 'MotDePasseFort'
```

Connecte-toi ensuite sur `https://wakalati.app/login` → tu es redirigé vers
`/super-admin` (console de gestion : agences, abonnements, licences, audit,
super-admins).

---

## 8. Vérifications post-déploiement

```bash
# API vivante
curl https://wakalati.app/api/health           # → {"status":"ok",...}

# Front servi
curl -I https://wakalati.app                    # → 200, text/html
```

Puis dans le navigateur : crée un compte agence sur `/register`, active une
licence de test depuis la console super-admin, vérifie l'envoi d'une facture
par e-mail si SMTP configuré.

---

## 9. Mises à jour ultérieures

```bash
cd app
git pull
cd backend && npm install && npx prisma migrate deploy && # Restart App (Plesk)
cd ../agence-facturation && npm install && npm run build
```

Le **Restart App** est obligatoire après chaque `git pull` (Node.js ne
recharge pas le code à chaud).

**Fichiers à sauvegarder** (hors Git et hors base) : `backend/src/uploads/`
(logos, publics) et `backend/storage/` (documents RH + justificatifs de
dépenses, **privés** — jamais dans le Document Root). À inclure dans les
sauvegardes Plesk avec le `pg_dump` de la base. Un `git pull` ne les touche pas.

---

## Récapitulatif des variables d'environnement

| Variable | Où | Obligatoire |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Backend | ✅ |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Backend | ✅ |
| `NODE_ENV=production` | Backend | ✅ |
| `FRONTEND_URL` (apex + www) | Backend | ✅ |
| `LICENSE_PRIVATE_KEY`, `LICENSE_PUBLIC_KEY` | Backend | ✅ pour les licences |
| `LICENSE_GRACE_HOURS` | Backend | ⬜ (défaut 72) |
| `SMTP_*`, `MAIL_FROM` | Backend | ⬜ (e-mails : factures, relances, invitations d'employés) |
| `REACT_APP_API_URL=/api` | Front (`.env.production`) | ✅ (déjà commité) |

Voir aussi **LICENSING.md** pour le fonctionnement détaillé des licences et la
rotation des clés.
