# Guide d'utilisation — Wakalaty en local (macOS) / دليل الاستخدام — تشغيل Wakalaty محليًا (macOS)

> 🇫🇷 Français ci-dessous, puis 🇩🇿🇸🇦 العربية بعد ذلك.

---

## 🇫🇷 Français

### 1. Prérequis à installer

| Outil | Pourquoi | Comment l'installer sur macOS |
|---|---|---|
| **Homebrew** | Gestionnaire de paquets macOS | `curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh \| bash` |
| **Git** | Télécharger le code | `brew install git` |
| **Node.js 18+** | Faire tourner backend + frontend | `brew install node` (vérifier avec `node -v`) |
| **Docker Desktop** | Faire tourner PostgreSQL sans rien configurer | Télécharger sur https://www.docker.com/products/docker-desktop/ |
| **GitHub CLI** *(optionnel)* | Cloner plus simplement si tu as les droits sur le dépôt | `brew install gh` puis `gh auth login` |

> Docker est le chemin le plus simple pour la base de données : pas besoin d'installer PostgreSQL toi-même.

### 2. Télécharger le code (cloner le dépôt)

```bash
cd ~/Desktop   # ou le dossier de ton choix
git clone git@github.com:Dr-nor/wakalati.git
cd wakalati
```

> Si le clone en SSH échoue (pas de clé configurée), utilise le HTTPS :
> `git clone https://github.com/Dr-nor/wakalati.git`
> On te demandera de te connecter à GitHub (identifiant + token) — demande l'accès au dépôt à Nariman si besoin.

### 3. Lancer la base de données PostgreSQL (via Docker)

Dans le dossier `wakalati` :

```bash
docker compose -f backend/docker-compose.yml up -d db
```

Ça démarre juste la base (pas le backend), sur le port `5432`, avec l'utilisateur `wakalati` / mot de passe `wakalati_secret`.

### 4. Installer et configurer le backend

```bash
cd backend
cp .env.example .env
npm install
```

Le fichier `.env` généré fonctionne tel quel avec la base Docker de l'étape 3 (ne rien changer si tu utilises Docker).

Créer les tables et les données de démo :

```bash
npx prisma migrate deploy
node prisma/seed.js
```

Démarrer le backend (reste ouvert dans ce terminal, port `4000`) :

```bash
npm start
```

### 5. Installer et configurer le frontend

Ouvre un **nouveau terminal** (laisse le backend tourner) :

```bash
cd wakalati/agence-facturation
cp .env.example .env
npm install
npm start
```

Le frontend s'ouvre automatiquement sur **http://localhost:3000**.

> Les variables `REACT_APP_FIREBASE_*` dans `.env` peuvent rester vides — elles ne sont pas utilisées par l'application actuellement.

### 6. Se connecter

Sur http://localhost:3000, connecte-toi avec l'un de ces comptes de test :

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin (agence de démo) | `admin@wakalati.com` | `admin123` |
| Super-admin (console `/super-admin`) | `beuvryclub@gmail.com` | `admin123` |

### 7. Problèmes fréquents

- **Port déjà utilisé (3000 ou 4000)** : un autre programme l'occupe. Trouve-le avec `lsof -i :3000` (ou `:4000`) et arrête-le, ou change le port dans `.env`.
- **`npx prisma migrate deploy` échoue** : vérifie que Docker tourne (`docker ps` doit montrer un conteneur `db`) et que `.env` pointe bien vers `localhost:5432`.
- **Le frontend n'arrive pas à parler au backend** : vérifie que `REACT_APP_API_URL=http://localhost:4000/api` dans `agence-facturation/.env`, et que le backend (étape 4) tourne toujours dans son terminal.
- **Tout arrêter proprement** : `Ctrl+C` dans les deux terminaux (front/back), puis `docker compose -f backend/docker-compose.yml down` pour arrêter la base.

---

## 🇩🇿 العربية

### 1. الأدوات المطلوبة قبل البدء

| الأداة | الغرض منها | طريقة التثبيت على macOS |
|---|---|---|
| **Homebrew** | مدير الحزم لنظام macOS | `curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh \| bash` |
| **Git** | لتحميل الكود من GitHub | `brew install git` |
| **Node.js 18+** | لتشغيل الواجهة الخلفية (backend) والواجهة الأمامية (frontend) | `brew install node` (تحقّق بالأمر `node -v`) |
| **Docker Desktop** | لتشغيل قاعدة بيانات PostgreSQL دون أي إعداد يدوي | نزّله من https://www.docker.com/products/docker-desktop/ |
| **GitHub CLI** *(اختياري)* | لتسهيل عملية التحميل إذا كانت لديك صلاحية الوصول للمشروع | `brew install gh` ثم `gh auth login` |

> استخدام Docker هو الطريقة الأسهل لقاعدة البيانات: لا حاجة لتثبيت PostgreSQL بنفسك.

### 2. تحميل الكود (استنساخ المشروع)

```bash
cd ~/Desktop   # أو أي مجلد تختاره
git clone git@github.com:Dr-nor/wakalati.git
cd wakalati
```

> إذا فشل الاستنساخ عبر SSH (لعدم وجود مفتاح مُهيّأ)، استخدم HTTPS بدلاً منه:
> `git clone https://github.com/Dr-nor/wakalati.git`
> سيُطلب منك تسجيل الدخول إلى GitHub (اسم المستخدم + رمز الدخول) — اطلب صلاحية الوصول إلى المشروع من نور الدين إذا احتجت لذلك.

### 3. تشغيل قاعدة بيانات PostgreSQL (عبر Docker)

داخل مجلد `wakalati`:

```bash
docker compose -f backend/docker-compose.yml up -d db
```

هذا الأمر يشغّل فقط قاعدة البيانات (وليس الخادم الخلفي) على المنفذ `5432`، باستخدام اسم المستخدم `wakalati` وكلمة المرور `wakalati_secret`.

### 4. تثبيت وإعداد الواجهة الخلفية (backend)

```bash
cd backend
cp .env.example .env
npm install
```

ملف `.env` الناتج يعمل مباشرة مع قاعدة بيانات Docker من الخطوة 3 (لا تغيّر شيئًا إذا كنت تستخدم Docker).

لإنشاء الجداول وبيانات التجربة:

```bash
npx prisma migrate deploy
node prisma/seed.js
```

لتشغيل الواجهة الخلفية (اترك هذه النافذة مفتوحة، المنفذ `4000`):

```bash
npm start
```

### 5. تثبيت وإعداد الواجهة الأمامية (frontend)

افتح **نافذة طرفية جديدة** (اترك الواجهة الخلفية تعمل):

```bash
cd wakalati/agence-facturation
cp .env.example .env
npm install
npm start
```

ستُفتح الواجهة الأمامية تلقائيًا على **http://localhost:3000**.

> يمكن ترك متغيرات `REACT_APP_FIREBASE_*` في ملف `.env` فارغة — فهي غير مستخدمة حاليًا في التطبيق.

### 6. تسجيل الدخول

على العنوان http://localhost:3000، سجّل الدخول بأحد الحسابين التاليين:

| الدور | البريد الإلكتروني | كلمة المرور |
|---|---|---|
| مدير (وكالة تجريبية) | `admin@wakalati.com` | `admin123` |
| مدير عام (لوحة `/super-admin`) | `beuvryclub@gmail.com` | `admin123` |

### 7. مشاكل شائعة

- **المنفذ مستخدم مسبقًا (3000 أو 4000)**: برنامج آخر يستخدمه. اكتشفه بالأمر `lsof -i :3000` (أو `:4000`) وأوقفه، أو غيّر المنفذ في `.env`.
- **فشل تنفيذ `npx prisma migrate deploy`**: تحقق أن Docker يعمل (`docker ps` يجب أن يظهر حاوية `db`) وأن `.env` يشير إلى `localhost:5432`.
- **الواجهة الأمامية لا تتصل بالواجهة الخلفية**: تحقق من أن `REACT_APP_API_URL=http://localhost:4000/api` في ملف `agence-facturation/.env`، وأن الواجهة الخلفية (الخطوة 4) لا تزال تعمل في نافذتها.
- **لإيقاف كل شيء بشكل صحيح**: اضغط `Ctrl+C` في كل من نافذتي الواجهة الأمامية والخلفية، ثم نفّذ `docker compose -f backend/docker-compose.yml down` لإيقاف قاعدة البيانات.
