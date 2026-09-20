# Guide d'installation complet — Wakalati sur VPS Plesk (`wakalati.app`)

Ce guide explique **pas à pas**, pour quelqu'un qui n'est **pas développeur**,
comment installer et mettre en ligne l'application Wakalati sur un serveur VPS
équipé de **Plesk**, sous le domaine **`wakalati.app`**.

Prenez votre temps, suivez les étapes **dans l'ordre**, et ne sautez rien. À la
fin, votre application sera accessible sur `https://wakalati.app`.

> 💡 **Conseil** : gardez un bloc-notes ouvert pour y coller les mots de passe
> et les clés secrètes que vous allez générer. Vous en aurez besoin plusieurs
> fois.

---

## Table des matières

1. [Comprendre ce qu'on installe (2 min de lecture)](#1-comprendre-ce-quon-installe)
2. [Petit glossaire des mots techniques](#2-petit-glossaire)
3. [Ce qu'il vous faut avant de commencer (prérequis)](#3-prérequis)
4. [Faire pointer le domaine wakalati.app vers le serveur](#4-faire-pointer-le-domaine)
5. [Installer les composants dans Plesk (Node.js, Git, PostgreSQL)](#5-installer-les-composants)
6. [Créer la base de données](#6-créer-la-base-de-données)
7. [Récupérer le code du projet](#7-récupérer-le-code)
8. [Générer les codes secrets (sécurité)](#8-générer-les-codes-secrets)
9. [Installer et démarrer le backend (le moteur)](#9-installer-et-démarrer-le-backend)
10. [Créer les tables dans la base (migrations)](#10-créer-les-tables-migrations)
11. [Rediriger `/api` vers le backend (reverse proxy)](#11-rediriger-api-vers-le-backend)
12. [Construire et publier le site (frontend)](#12-construire-et-publier-le-frontend)
13. [Activer le HTTPS (cadenas de sécurité)](#13-activer-le-https)
14. [Créer votre compte super-administrateur](#14-créer-votre-compte-super-administrateur)
15. [Vérifier que tout fonctionne](#15-vérifier-que-tout-fonctionne)
16. [Activer l'envoi d'e-mails (optionnel)](#16-activer-lenvoi-de-mails-optionnel)
17. [Mettre à jour l'application plus tard](#17-mettre-à-jour-lapplication-plus-tard)
18. [Dépannage : les erreurs les plus fréquentes](#18-dépannage)
19. [Récapitulatif des variables d'environnement](#19-récapitulatif-des-variables)
20. [Checklist finale](#20-checklist-finale)

---

## 1. Comprendre ce qu'on installe

L'application Wakalati est composée de **deux morceaux** qui travaillent ensemble :

- **Le frontend** (« l'avant ») : c'est le **site web** que voient vos
  utilisateurs dans leur navigateur (les pages, les boutons, les couleurs).
  Techniquement, ce sont des fichiers **statiques** (HTML, CSS, JavaScript)
  qu'on « construit » une fois, puis qu'on dépose sur le serveur.
- **Le backend** (« l'arrière ») : c'est le **moteur invisible**. Il gère les
  comptes, les factures, la base de données, les e-mails, etc. C'est un
  programme **Node.js** qui tourne en permanence sur le serveur.

Entre les deux, il y a **la base de données** (**PostgreSQL**) : c'est le
grand classeur où tout est rangé (clients, factures, dépenses, congés,
pointages, budgets, fournisseurs…).

> 📁 Deux choses vivent **en dehors** de la base, sous forme de fichiers sur
> le disque du serveur : les **logos** (`backend/src/uploads/`, publics) et
> les **documents privés** — documents RH des employés et justificatifs de
> dépenses (`backend/storage/`, servis uniquement aux utilisateurs
> autorisés). À inclure dans vos sauvegardes (voir étape 17).

**Comment ils communiquent ?**

```
 Navigateur de l'utilisateur
        │
        ▼
 https://wakalati.app          ← le site (frontend, fichiers statiques)
        │
        │  quand le site a besoin de données, il appelle…
        ▼
 https://wakalati.app/api/...  ← le moteur (backend Node.js)
        │
        ▼
 Base de données PostgreSQL     ← là où tout est stocké
```

**L'astuce importante** : tout est sous **un seul domaine** (`wakalati.app`).
Les adresses qui commencent par `/api` sont **redirigées en interne** vers le
moteur Node.js. Le reste affiche le site. On configurera cette redirection à
l'[étape 11](#11-rediriger-api-vers-le-backend).

---

## 2. Petit glossaire

| Mot | Ce que ça veut dire, simplement |
|---|---|
| **VPS** | Votre serveur loué, une machine allumée en permanence sur Internet. |
| **Plesk** | Le tableau de bord (interface web) pour administrer le serveur sans tout taper à la main. |
| **SSH / Terminal** | Une fenêtre où l'on tape des commandes texte pour parler au serveur. Plesk en propose une intégrée. |
| **Node.js** | Le langage/environnement dans lequel tourne le moteur (backend). |
| **PostgreSQL** | Le logiciel de base de données. |
| **Migration** | Une commande qui **crée automatiquement les tables** (clients, factures…) dans la base. |
| **Variable d'environnement** | Un réglage secret (mot de passe, clé) qu'on donne au moteur **sans l'écrire dans le code**. |
| **Build** | L'opération qui « compile » le site en fichiers prêts à publier. |
| **Reverse proxy** | Une règle qui dit « les adresses en `/api`, envoie-les au moteur Node.js ». |
| **Let's Encrypt** | Le service **gratuit** qui fournit le certificat HTTPS (le cadenas 🔒). |

---

## 3. Prérequis

Avant de commencer, assurez-vous d'avoir :

- ✅ Un **VPS avec Plesk** installé, et vos identifiants de connexion à Plesk
  (adresse du type `https://IP-DU-SERVEUR:8443`).
- ✅ Le **domaine `wakalati.app`** que vous possédez (acheté chez un
  registrar : GoDaddy, Namecheap, OVH…).
- ✅ Un **accès SSH** au serveur (Plesk en fournit un intégré, on verra où).
- ✅ Environ **1 heure** devant vous, au calme.

Vous **n'avez pas besoin** de savoir programmer. Vous allez surtout
**copier-coller** des commandes et **cliquer** dans Plesk.

---

## 4. Faire pointer le domaine

Pour que `wakalati.app` affiche votre serveur, le domaine doit **pointer vers
l'adresse IP** du VPS.

1. Trouvez **l'adresse IP** de votre VPS (elle est affichée dans Plesk, page
   d'accueil, ou fournie par votre hébergeur). Exemple : `203.0.113.45`.
2. Connectez-vous chez votre **registrar** (là où vous avez acheté le domaine).
3. Dans la **zone DNS**, créez (ou modifiez) deux enregistrements de type
   **A** :

   | Type | Nom / Hôte | Valeur (pointe vers) |
   |---|---|---|
   | A | `@`   | `203.0.113.45` (l'IP de votre VPS) |
   | A | `www` | `203.0.113.45` (la même IP) |

4. Enregistrez. **La propagation DNS peut prendre de 10 minutes à quelques
   heures.** Pour vérifier, tapez dans un terminal de votre ordinateur :
   ```bash
   ping wakalati.app
   ```
   Si l'IP affichée est celle de votre VPS, c'est bon.

5. Dans **Plesk**, créez le domaine : **Sites web & domaines → Ajouter un
   domaine → `wakalati.app`**. Laissez les options par défaut pour l'instant.

---

## 5. Installer les composants

Dans Plesk, on installe les briques nécessaires. **Vous ferez ça une seule
fois.**

### 5.1 L'extension Node.js

1. Plesk → **Extensions** (menu de gauche).
2. Cherchez **« Node.js »** → **Installer**.
3. Une fois installé, chaque domaine aura un onglet **« Node.js »**.

### 5.2 Git (pour récupérer le code)

- Git est en général déjà présent. Pour vérifier, on l'utilisera à l'étape 7.
- Sinon, l'extension **« Git »** de Plesk fait le travail via l'interface.

### 5.3 PostgreSQL (la base de données)

PostgreSQL n'est pas toujours activé par défaut dans Plesk.

1. Plesk → **Outils & Paramètres → Mise à jour et mise à niveau** (Plesk
   Installer) → **Ajouter/Supprimer des composants**.
2. Cochez **PostgreSQL server** → **Continuer** pour l'installer.
3. Attendez la fin de l'installation.

> ℹ️ **Version** : ce projet est prévu pour **PostgreSQL 16** (les versions 14
> et 15 fonctionnent aussi). Node.js : **version 18 ou plus récente**.

---

## 6. Créer la base de données

On crée le « classeur » vide et un utilisateur qui a le droit d'y écrire.

1. Plesk → domaine `wakalati.app` → **Bases de données → Ajouter une base de
   données**.
2. Renseignez :
   - **Type de base** : **PostgreSQL**
   - **Nom de la base** : `wakalati`
   - **Nom d'utilisateur** : `wakalati`
   - **Mot de passe** : cliquez sur **Générer**, puis **copiez-le dans votre
     bloc-notes** (vous en aurez besoin à l'étape 9). Exemple : `Xy7kP2mQ...`
3. Validez.

Vous avez maintenant :
- une base nommée `wakalati`,
- un utilisateur `wakalati`,
- un mot de passe (celui que vous venez de copier).

Ces trois éléments forment **l'adresse de connexion** à la base, qu'on écrira
ainsi (gardez ce modèle sous la main) :

```
postgresql://wakalati:LE_MOT_DE_PASSE@localhost:5432/wakalati
```

Remplacez `LE_MOT_DE_PASSE` par le mot de passe copié. `localhost` signifie
« la base est sur le même serveur », et `5432` est le port standard de
PostgreSQL.

> ⚠️ **Vérifiez le port !** Sur certains VPS Plesk, PostgreSQL n'écoute pas
> sur `5432` mais sur un autre port (par exemple **`5433`**, fréquent quand
> Plesk installe sa propre instance). Pour le connaître :
> `ss -lntp | grep postgres` (ou regardez dans Plesk → Bases de données).
> Utilisez ce port-là dans **les deux** URLs (`DATABASE_URL` et `DIRECT_URL`),
> sinon les migrations échoueront avec « Connection refused ».

---

## 7. Récupérer le code

On va télécharger le code du projet depuis GitHub sur le serveur.

### 7.1 Ouvrir un terminal SSH dans Plesk

Plesk → domaine `wakalati.app` → **Accès SSH au terminal** (ou activez
l'accès SSH puis connectez-vous avec un client comme PuTTY). Une fenêtre noire
s'ouvre : c'est le **terminal**. C'est là qu'on tape les commandes.

Placez-vous dans le dossier du domaine :

```bash
cd ~/wakalati.app        # ou : cd /var/www/vhosts/wakalati.app
```

### 7.2 Cloner le projet

Le dépôt `git@github.com:Dr-nor/wakalati.git` est **privé** : il faut donc
prouver à GitHub que vous avez le droit d'y accéder. Choisissez **une** des
trois méthodes ci-dessous. La **méthode A (clé de déploiement SSH)** est la
plus propre sur un serveur et **recommandée**.

**Option A — clé de déploiement SSH (recommandée pour un serveur)**

Une « clé de déploiement » est une clé **en lecture seule**, liée à ce seul
dépôt. Rien de secret ne traîne dans la configuration du projet.

1. Sur le serveur, générez une paire de clés (appuyez sur Entrée à chaque
   question pour accepter les valeurs par défaut, **sans passphrase**) :
   ```bash
   ssh-keygen -t ed25519 -C "wakalati-vps" -f ~/.ssh/wakalati_deploy
   ```
2. Affichez la clé **publique** et copiez tout ce qui s'affiche :
   ```bash
   cat ~/.ssh/wakalati_deploy.pub
   ```
3. Sur GitHub : dépôt **wakalati → Settings → Deploy keys → Add deploy key**.
   Collez la clé, donnez un titre (ex. « VPS Plesk »), **laissez « Allow write
   access » décoché**, validez.
4. Dites à SSH d'utiliser cette clé pour GitHub. Créez/éditez le fichier
   `~/.ssh/config` et ajoutez :
   ```
   Host github.com
     IdentityFile ~/.ssh/wakalati_deploy
     IdentitiesOnly yes
   ```
5. Clonez :
   ```bash
   git clone git@github.com:Dr-nor/wakalati.git app
   ```
   *(La première fois, tapez `yes` pour accepter l'empreinte de GitHub.)*

**Option B — jeton d'accès personnel (plus rapide, un peu moins propre)**
1. Sur GitHub : **votre photo → Settings → Developer settings → Personal
   access tokens → Tokens (classic) → Generate new token**, cochez `repo`,
   générez, **copiez le jeton** (il commence par `ghp_...`).
2. Sur le serveur :
   ```bash
   git clone https://VOTRE_JETON@github.com/Dr-nor/wakalati.git app
   ```
   (remplacez `VOTRE_JETON` par le jeton copié).
   > ⚠️ Le jeton reste ensuite **écrit en clair** dans `app/.git/config`.
   > Donnez-lui une **date d'expiration** sur GitHub, et régénérez-le si besoin.

**Option C — sans Git (téléchargement manuel)**
Sur GitHub : bouton vert **Code → Download ZIP**, puis dans Plesk
**Gestionnaire de fichiers**, téléversez le ZIP dans le dossier du domaine et
**extrayez-le**. Renommez le dossier obtenu en `app`.
> Inconvénient : pas de `git pull` pour les mises à jour (étape 17) — il faudra
> re-télécharger le ZIP à chaque fois. Les méthodes A ou B sont préférables.

Après cette étape, vous devez avoir un dossier **`app`** contenant deux
sous-dossiers importants :
- `app/backend` → le moteur (Node.js)
- `app/agence-facturation` → le site (React)

Vérifiez :
```bash
ls app
# doit afficher : backend  agence-facturation  ... (et d'autres fichiers)
```

---

## 8. Générer les codes secrets

Le moteur a besoin de deux secrets de sécurité. On les génère **une seule
fois**. Restez dans le terminal.

```bash
cd ~/wakalati.app/app/backend

# 1) Le secret JWT (sert à sécuriser les connexions). Génère une longue chaîne.
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 2) Les clés de licence (le système de licences de l'app).
node scripts/generate-license-keypair.js
```

- La **première commande** affiche une longue suite de caractères : c'est votre
  **`JWT_SECRET`**. Copiez-la dans votre bloc-notes.
- La **deuxième commande** affiche deux clés : **`LICENSE_PRIVATE_KEY`** et
  **`LICENSE_PUBLIC_KEY`** (chacune sur une ligne, avec des `\n` dedans —
  c'est normal). Copiez **les deux lignes** dans votre bloc-notes.

> 🔒 **Très important** : ces secrets ne doivent **jamais** être partagés ni
> publiés sur Internet. Ils vivent uniquement sur le serveur.

---

## 9. Installer et démarrer le backend

On configure le moteur Node.js dans Plesk.

1. Plesk → domaine `wakalati.app` → onglet **Node.js**.
2. Renseignez :

   | Champ | Valeur à mettre |
   |---|---|
   | **Version de Node.js** | 18 ou supérieure |
   | **Racine de l'application** (Application Root) | `app/backend` |
   | **Fichier de démarrage** (Application Startup File) | `src/index.js` |
   | **Mode de l'application** | `production` |

3. Cliquez sur **« Variables d'environnement personnalisées »** (Custom
   environment variables) et ajoutez les lignes suivantes (une variable = un
   nom + une valeur). Remplacez les valeurs par les vôtres (mot de passe base,
   secrets de l'étape 8) :

   | Nom | Valeur |
   |---|---|
   | `DATABASE_URL` | `postgresql://wakalati:LE_MOT_DE_PASSE@localhost:5432/wakalati` |
   | `DIRECT_URL` | `postgresql://wakalati:LE_MOT_DE_PASSE@localhost:5432/wakalati` |
   | `JWT_SECRET` | *(le secret JWT de l'étape 8)* |
   | `JWT_EXPIRES_IN` | `7d` |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | `https://wakalati.app,https://www.wakalati.app` |
   | `LICENSE_PRIVATE_KEY` | *(la clé privée de l'étape 8)* |
   | `LICENSE_PUBLIC_KEY` | *(la clé publique de l'étape 8)* |
   | `LICENSE_GRACE_HOURS` | `72` |

   > ⚠️ Ne définissez **pas** de variable `PORT` : Plesk s'en occupe tout seul.

4. Cliquez sur **« NPM install »** (bouton dans l'onglet Node.js). Cela
   télécharge tout ce dont le moteur a besoin. Patientez (1 à 3 minutes).
   *(En SSH, l'équivalent est `cd ~/wakalati.app/app/backend && npm install`.)*

5. **Ne redémarrez pas encore** — il reste à créer les tables (étape 10).

---

## 10. Créer les tables (migrations)

La base est vide : on y crée automatiquement toutes les tables (clients,
factures, tâches, licences, audit…) avec **une seule commande**.

Dans le terminal SSH :

```bash
cd ~/wakalati.app/app/backend
npx prisma migrate deploy
```

Vous devez voir une liste de migrations « **Applying migration…** » puis
**« All migrations have been successfully applied. »**. 🎉

Ensuite, retournez dans Plesk → onglet **Node.js** → cliquez sur **« Restart
App »** (Redémarrer l'application).

> ✅ Le moteur tourne maintenant. Il lance aussi tout seul ses **tâches
> planifiées** (relances d'impayés, factures récurrentes, expiration des
> abonnements) — vous n'avez rien à configurer pour ça.

---

## 11. Rediriger `/api` vers le backend

Il faut dire au serveur web : « toutes les adresses en `/api` (et `/uploads`),
envoie-les au moteur Node.js ». C'est le **reverse proxy**.

1. Dans l'onglet **Node.js** de Plesk, notez le **port** sur lequel tourne
   l'application (souvent affiché, ex. `PORT 35xxx`). Appelons-le
   **`PORT_NODE`**.
2. Plesk → domaine → **Apache & nginx Settings** (Paramètres Apache & nginx).
3. Dans **« Directives nginx additionnelles »**, collez ceci (en remplaçant
   `PORT_NODE` par le vrai numéro) :

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

4. **Appliquer / OK**.

> ℹ️ L'application est déjà configurée pour fonctionner derrière ce proxy
> (`trust proxy`), donc la sécurité (limites de requêtes, journal d'audit) reste
> correcte.

> 🧩 **Si vous ne voyez pas de port à proxifier** dans votre version de Plesk
> (certaines intègrent Node.js différemment), utilisez plutôt la variante
> **sous-domaine** décrite en [annexe](#annexe--variante-sous-domaine-api).

---

## 12. Construire et publier le frontend

On « construit » le site et on le met à la racine du domaine.

```bash
cd ~/wakalati.app/app/agence-facturation
npm install
npm run build
```

- `npm install` télécharge les outils (1 à 3 min).
- `npm run build` crée un dossier **`build/`** contenant le site prêt à
  publier. Le fichier `.env.production` du projet contient déjà
  `REACT_APP_API_URL=/api`, donc le site appellera automatiquement `/api` sur
  le même domaine — **rien à modifier**.

Maintenant, dites à Plesk de **servir ce dossier `build/`** comme racine du
site :

1. Plesk → domaine → **Paramètres d'hébergement** (Hosting Settings).
2. Champ **« Racine du document »** (Document Root) : mettez
   `app/agence-facturation/build`.
3. Enregistrez.

*(Alternative : copiez le contenu de `build/` dans le dossier `httpdocs/` du
domaine.)*

### SPA fallback (important)

L'application a plusieurs pages internes (`/login`, `/dashboard`, `/aide`…).
Pour qu'elles s'affichent même en cas de rafraîchissement, ajoutez cette règle
dans les **directives nginx additionnelles** (là où vous avez mis le proxy à
l'étape 11) :

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Cette règle sert les fichiers réels quand ils existent (comme le manuel
`/manuel.html`) et renvoie toutes les autres adresses vers l'application.

---

## 13. Activer le HTTPS

Le HTTPS (cadenas 🔒) est **gratuit** et **obligatoire** (sinon les navigateurs
affichent « non sécurisé »).

1. Plesk → domaine → **Certificats SSL/TLS**.
2. **Installer un certificat Let's Encrypt gratuit**.
3. Cochez **`wakalati.app`** ET **`www.wakalati.app`**.
4. Validez.
5. Toujours dans le domaine, activez **« Rediriger de HTTP vers HTTPS »**
   (Redirect from http to https) pour forcer le cadenas.

Plesk gère tout le chiffrement : le moteur Node.js n'a rien à configurer de
plus.

---

## 14. Créer votre compte super-administrateur

Le **super-administrateur** est le compte qui gère toute la plateforme
(agences, abonnements, licences). Pour des raisons de sécurité, il ne peut
**pas** se créer depuis le site : on le crée en une commande.

Dans le terminal SSH :

```bash
cd ~/wakalati.app/app/backend
node scripts/create-super-admin.js admin@wakalati.app "Votre Nom" 'UnMotDePasseFort'
```

- Remplacez l'e-mail, le nom et le mot de passe par les vôtres.
- **Gardez les guillemets simples** `'...'` autour du mot de passe (sinon les
  caractères spéciaux comme `!` ou `$` posent problème).

Vous verrez : **« ✅ Super-admin prêt … »**.

Connectez-vous ensuite sur `https://wakalati.app/login` : vous serez redirigé
vers la **console super-admin** (`/super-admin`).

> 🔑 **Astuce** : cette commande sert aussi à **réinitialiser** le mot de passe
> si vous l'oubliez — relancez-la avec le même e-mail et un nouveau mot de passe.

---

## 15. Vérifier que tout fonctionne

Dans le terminal SSH (ou dans un navigateur) :

```bash
# 1) Le moteur répond ?
curl https://wakalati.app/api/health
# Réponse attendue : {"status":"ok","timestamp":"..."}

# 2) Le site est servi ?
curl -I https://wakalati.app
# Réponse attendue : HTTP/2 200 ... content-type: text/html
```

Puis dans votre navigateur :
1. Ouvrez `https://wakalati.app` → la page d'accueil doit s'afficher, avec le
   cadenas 🔒.
2. Testez `/register` (créer une agence de test).
3. Connectez-vous en super-admin sur `/login` et faites un tour de la console.

Si quelque chose cloche, allez au [Dépannage](#18-dépannage).

---

## 16. Activer l'envoi d'e-mails (optionnel mais recommandé)

Sans configuration, l'application marche très bien — l'envoi d'e-mails
(factures au client, relances d'impayés, **invitations des employés à créer
leur compte**) est simplement **désactivé proprement**.

> 💡 Cas particulier des **invitations d'employés** (module Équipe) : sans
> SMTP, le bouton « Inviter » fonctionne quand même — le lien d'invitation
> (valable 72 h) est **copié dans le presse-papier** de l'admin, à partager
> par WhatsApp/SMS. Avec SMTP, l'e-mail part automatiquement.

Pour l'activer, il faut un **fournisseur SMTP** (Brevo/Sendinblue, Mailgun,
Gmail avec mot de passe d'application, ou le serveur mail de votre VPS).
Ajoutez ces variables d'environnement dans Plesk → Node.js (comme à
l'étape 9), puis **Restart App** :

| Nom | Exemple |
|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | *(identifiant SMTP fourni par votre service)* |
| `SMTP_PASS` | *(mot de passe SMTP)* |
| `MAIL_FROM` | `Wakalati <no-reply@wakalati.app>` |

---

## 17. Mettre à jour l'application plus tard

Quand une nouvelle version est disponible sur GitHub :

```bash
cd ~/wakalati.app/app

# 1) Récupérer le nouveau code
git pull

# 2) Mettre à jour le moteur + appliquer d'éventuelles nouvelles tables
cd backend
npm install
npx prisma migrate deploy

# 3) Reconstruire le site
cd ../agence-facturation
npm install
npm run build
```

Enfin, Plesk → Node.js → **Restart App**.

> 💡 Les migrations sont **cumulatives et sûres** : `migrate deploy` n'applique
> que ce qui manque, sans toucher à vos données existantes.
>
> ⚠️ Le **Restart App est indispensable** après chaque `git pull` : Node.js ne
> recharge pas le code tout seul — sans redémarrage, les nouvelles pages
> répondront « Route introuvable ».

### Fichiers à préserver et à sauvegarder

Deux dossiers contiennent des **fichiers uploadés par vos utilisateurs** — ils
ne sont **pas dans Git** ni dans la base de données :

| Dossier | Contenu | Accès |
|---|---|---|
| `app/backend/src/uploads/` | Logos des agences | Public (`/uploads`) |
| `app/backend/storage/` | **Documents RH** des employés (contrats, pièces) et **justificatifs de dépenses** | Privé — servi uniquement via l'API, aux rôles autorisés |

- Un `git pull` ne les touche pas : les mises à jour sont **sans risque**.
- En revanche, **ne supprimez jamais** ces dossiers, et incluez-les dans vos
  **sauvegardes Plesk** (Outils & Paramètres → Gestionnaire de sauvegardes),
  au même titre que la base PostgreSQL (`pg_dump wakalati`).
- Ne mettez jamais `backend/storage/` dans le Document Root du site : il doit
  rester **hors de la zone servie publiquement** (c'est tout son intérêt).

---

## 18. Dépannage

### La page affiche « 502 Bad Gateway »
Le moteur Node.js n'est pas démarré, ou le **port** du reverse proxy est faux.
- Plesk → Node.js → vérifiez que l'app est **démarrée** ; sinon **Restart App**.
- Vérifiez que `PORT_NODE` dans les directives nginx = le port affiché dans
  l'onglet Node.js.

### Le moteur refuse de démarrer
Regardez les logs : Plesk → Node.js → **« Show logs »**, ou en SSH le fichier
de logs indiqué. Causes fréquentes :
- **`Missing required env: DATABASE_URL`** ou **`JWT_SECRET`** → une variable
  d'environnement est absente ou mal orthographiée (étape 9).
- **Erreur de connexion à la base** → le `DATABASE_URL` est faux (mot de passe,
  nom de base). Recopiez-le soigneusement.

### « Impossible de se connecter » / le site ne joint pas le moteur
- Ouvrez `https://wakalati.app/api/health`. Si ça ne répond pas, c'est le
  **reverse proxy** (étape 11) : port ou règle nginx incorrecte.
- Vérifiez que `FRONTEND_URL` contient bien `https://wakalati.app` (étape 9),
  sinon le navigateur bloque les appels (erreur **CORS**).

### Page blanche après connexion, ou « t is not defined » dans la console
Le build du frontend est ancien ou a échoué. Refaites :
```bash
cd ~/wakalati.app/app/agence-facturation && npm run build
```
puis videz le cache du navigateur (Ctrl+F5).

### Les migrations échouent
- **« database does not exist »** → la base n'a pas été créée (étape 6) ou le
  nom dans `DATABASE_URL` est faux.
- **« permission denied »** → l'utilisateur/mot de passe de la base est
  incorrect.

### Une page interne (ex. `/dashboard`) renvoie une erreur 404 en rafraîchissant
Il manque la règle **SPA fallback** (`try_files … /index.html`) — voir
[étape 12](#12-construire-et-publier-le-frontend).

### Le drapeau, le thème, ou une page semble « figée » après mise à jour
C'est le **cache du navigateur**. Faites **Ctrl+F5** (rechargement forcé).

---

## 19. Récapitulatif des variables

| Variable | Où | Obligatoire ? | Rôle |
|---|---|---|---|
| `DATABASE_URL` | Backend | ✅ | Adresse de la base de données |
| `DIRECT_URL` | Backend | ✅ | Idem (utilisée par Prisma) |
| `JWT_SECRET` | Backend | ✅ | Sécurise les connexions |
| `JWT_EXPIRES_IN` | Backend | ✅ | Durée de validité d'une connexion (`7d`) |
| `NODE_ENV` | Backend | ✅ | Mettre `production` |
| `FRONTEND_URL` | Backend | ✅ | Domaines autorisés (apex + www) |
| `LICENSE_PRIVATE_KEY` | Backend | ✅* | Signe les licences |
| `LICENSE_PUBLIC_KEY` | Backend | ✅* | Vérifie les licences |
| `LICENSE_GRACE_HOURS` | Backend | ⬜ | Tolérance avant blocage (défaut 72) |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Backend | ⬜ | E-mails : factures, relances, invitations d'employés |
| `REACT_APP_API_URL` | Frontend (`.env.production`) | ✅ | Déjà réglé sur `/api` |

*\* Obligatoires pour que le système de licences fonctionne. Sans elles, le
serveur démarre quand même mais le module licences est désactivé.*

Voir aussi **`LICENSING.md`** (fonctionnement des licences) et
**`DEPLOYMENT.md`** (version condensée de ce guide).

---

## 20. Checklist finale

- [ ] DNS : `wakalati.app` et `www` pointent vers l'IP du VPS
- [ ] Domaine créé dans Plesk
- [ ] Node.js, Git et PostgreSQL installés
- [ ] Base `wakalati` + utilisateur + mot de passe créés
- [ ] Code cloné dans `app/` (avec `backend/` et `agence-facturation/`)
- [ ] Secrets générés (`JWT_SECRET`, clés de licence)
- [ ] Backend configuré (Application Root, Startup File, variables d'env)
- [ ] `npm install` backend fait
- [ ] `npx prisma migrate deploy` réussi
- [ ] Reverse proxy `/api` + `/uploads` configuré
- [ ] Frontend construit (`npm run build`) + Document Root réglé
- [ ] SPA fallback (`try_files`) ajouté
- [ ] HTTPS Let's Encrypt activé (+ redirection HTTP→HTTPS)
- [ ] Super-admin créé
- [ ] `/api/health` répond `{"status":"ok"}`
- [ ] `https://wakalati.app` s'affiche avec le cadenas 🔒
- [ ] SMTP configuré (recommandé : invitations d'employés, factures, relances)
- [ ] Sauvegardes Plesk : base PostgreSQL **et** `backend/storage/` + `backend/src/uploads/`

**Bravo — votre application est en ligne !** 🎉

---

## Annexe — Variante sous-domaine (`api.wakalati.app`)

Si votre version de Plesk ne permet pas de reverse-proxifier `/api` vers un
port (étape 11), la solution la plus simple est de mettre **le moteur sur un
sous-domaine** dédié. Plesk gère alors tout automatiquement (Passenger).

1. Plesk → **Ajouter un sous-domaine** `api.wakalati.app`.
2. Sur ce sous-domaine, configurez le **Node.js** exactement comme à
   l'[étape 9](#9-installer-et-démarrer-le-backend) (Application Root
   `app/backend`, Startup File `src/index.js`, mêmes variables d'environnement).
   Ici, **pas besoin de reverse proxy** : le sous-domaine EST le moteur.
3. Le domaine principal `wakalati.app` sert uniquement le frontend (Document
   Root = `app/agence-facturation/build`, + SPA fallback).
4. **Avant** de construire le frontend, changez l'adresse de l'API. Modifiez le
   fichier `app/agence-facturation/.env.production` :
   ```
   REACT_APP_API_URL=https://api.wakalati.app/api
   ```
   puis reconstruisez : `npm run build`.
5. Activez le HTTPS Let's Encrypt sur **les deux** : `wakalati.app` **et**
   `api.wakalati.app`.
6. Vérifiez que `FRONTEND_URL` (backend) contient bien
   `https://wakalati.app,https://www.wakalati.app` : c'est ce qui autorise le
   site à parler au moteur (CORS).

Test : `https://api.wakalati.app/api/health` doit répondre `{"status":"ok"}`.
