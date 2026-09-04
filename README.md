# my-sms

> my-sms est une application de chat web épurée, semblable à WhatsApp, conçue exclusivement pour discuter entre amis. Sans fil d'actualité ni fonctionnalités superflues, la plateforme se concentre sur l'essentiel : des conversations privées, directes et sans distractions.

**100 % temps réel, 100 % en français, prête pour la production.**

![stack](https://img.shields.io/badge/Node.js-22-339933) ![stack](https://img.shields.io/badge/React-19-61dafb) ![stack](https://img.shields.io/badge/PostgreSQL-16-4169a1) ![stack](https://img.shields.io/badge/WebSockets-Socket.IO-e11d48)

---

## ✨ Fonctionnalités

| | |
|---|---|
| ⚡ **Temps réel** | Messages instantanés, présence en ligne/hors ligne, « vu à… », indicateur *est en train d'écrire…* |
| ✅ **Accusés** | envoyés (✓) → livrés (✓✓) → lus (✓✓ bleus), calculés sans colonne par message |
| 🔎 **Recherche d'amis** | Par nom, @pseudo ou e-mail, conversations créées en un clic |
| 🕘 **Historique paginé** | Curseur par identifiant (pas de `OFFSET` lent), remontée infinie en gardant la position du scroll |
| 🔔 **Non-lus** | Badges en temps réel, total dans le titre de l'onglet, accusé de lecture automatique |
| 🎨 **Interface moderne** | Thème clair **et** sombre, responsive mobile → desktop, animations douces, accessibilité (ARIA, focus visible, `prefers-reduced-motion`) |
| 🔐 **Sécurité** | bcrypt (coût 12), sessions révocables en cookie `httpOnly`, anti timing-attack, rate-limiting (auth + anti-spam messages), helmet, requêtes 100 % paramétrées |
| 📈 **Passage à l'échelle** | Serveur stateless, Socket.IO + Redis pour le multi-instance, index SQL sur tous les chemins chauds, pagination par curseur |

## 🧱 Stack technique

- **Backend** — Node.js 22, Express 5, Socket.IO 4, PostgreSQL 16 (`pg`), bcryptjs
- **Frontend** — React 19, Vite 6, CSS maison (design system par variables, zéro framework UI)
- **Infra** — Dockerfile multi-étages, docker-compose (Postgres + Redis), tests de fumée API + E2E

```
my-sms/
├── server/               # API REST + WebSocket
│   └── src/
│       ├── index.js      # point d'entrée (Express + Socket.IO + build statique)
│       ├── config.js     # configuration par variables d'environnement
│       ├── db.js         # pool PostgreSQL + transactions
│       ├── schema.sql    # schéma (idempotent, index inclus)
│       ├── auth.js       # sessions révocables, bcrypt, cookies
│       ├── presence.js   # état « en ligne »
│       ├── sockets.js    # message:send / conversation:read / typing / présence
│       ├── migrate.js    # npm run migrate
│       ├── seed.js       # données de démo (npm run seed)
│       ├── routes/       # auth, users, conversations
│       └── util/         # validation, rate limiting
├── client/               # React + Vite
│   └── src/
│       ├── App.jsx       # orchestration (état, socket, actions)
│       ├── api.js        # wrapper fetch
│       ├── socket.js     # client Socket.IO
│       ├── time.js       # formatage des dates FR
│       ├── styles.css    # design system (thèmes clair/sombre)
│       └── components/   # AuthScreen, Sidebar, ChatWindow, modale, toasts, icônes SVG
├── scripts/
│   ├── dev-db.js         # PostgreSQL 16 embarqué (npm run dev:db)
│   ├── smoke.js          # tests API + temps réel (17 assertions)
│   └── e2e-proxy.mjs     # E2E « vue navigateur » à travers le proxy Vite
├── Dockerfile
└── docker-compose.yml
```

## 🚀 Démarrage rapide (développement)

Prérequis : **Node.js ≥ 20**. Aucune installation de PostgreSQL requise — un Postgres 16 officiel embarqué est téléchargé via npm.

```bash
npm install          # installe server + client + Postgres embarqué
npm run dev:db       # 1/ démarre PostgreSQL 16 local (port 5433)  ← laisser ouvert
npm run migrate      # 2/ applique le schéma
npm run seed         # 3/ (optionnel) comptes de démo + conversations
npm run dev          # 4/ API (port 4000) + interface Vite (port 5173)
```

Ouvrir **http://localhost:5173** — comptes de démo : `alice@demo.dev`, `bob@demo.dev`, `chloe@demo.dev` / `demo1234`.

> En production, `dev:db` disparaît : tu pointes `DATABASE_URL` vers ton PostgreSQL.

## 🧪 Tests

```bash
npm run smoke        # API + temps réel (inscription, login, recherche, messages,
                     #   accusés de lecture, non-lus, pagination, anti-spam)
npm run smoke:e2e    # E2E complet à travers le proxy Vite (comme le navigateur)
```

## 📦 Production

**Docker (recommandé) :**

```bash
docker compose up -d --build     # app (port 4000) + PostgreSQL 16
# multi-instance : docker compose --profile scale up -d   (+ définir REDIS_URL)
```

Le serveur sert l'API **et** le build Vite (`client/dist`) sur un seul port — place-le derrière ton reverse proxy TLS (Caddy/Nginx) avec proxy WebSocket, puis passe `COOKIE_SECURE=true`.

**Sans Docker :** `npm ci && npm run build`, puis `DATABASE_URL=… NODE_ENV=production npm start`.

### Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `4000` | Port HTTP + WebSocket |
| `DATABASE_URL` | local dev | Connexion PostgreSQL |
| `REDIS_URL` | — | Multi-instance Socket.IO (adapter Redis) |
| `COOKIE_SECURE` | `false` | `true` derrière HTTPS |
| `TOKEN_TTL_DAYS` | `30` | Durée de vie des sessions |
| `NODE_ENV` | `development` | `production` en live |

## ⚖️ Architecture & passage à l'échelle

- **Stateless** : l'authentification repose sur un jeton opaque révocable (hash en base) stocké en cookie `httpOnly` — aucune session en mémoire serveur, les instances sont interchangeables.
- **Temps réel multi-instance** : définir `REDIS_URL` branche l'adapter Redis de Socket.IO (présence et événements partagés). Un équilibreur de charge WebSocket devant les instances suffit.
- **Base de données** : index sur chaque FK et chaque requête chaude (liste de conversations en 1 requête avec `LATERAL` pour dernier message + non-lus ; historique paginé par curseur `id < before` — O(limit), jamais de défilement).
- **Limiter** : 30 requêtes d'authentification / 15 min / IP · 30 messages / 10 s / socket · corps JSON plafonné à 16 Ko · `maxHttpBufferSize` 100 Ko.
- **Lecture/écriture des accusés** : `last_read_at` par membre (jamais reculée, mise à jour conditionnelle en base) — le statut de chaque message se déduit sans colonne par message, ce qui garde les messages à 4 colonnes utiles.

## 🔌 API (résumé)

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Créer un compte (retourne la session) |
| POST | `/api/auth/login` · `/logout` · `password` | Sessions |
| GET | `/api/auth/me` | Utilisateur courant |
| GET | `/api/users/search?q=` | Recherche d'utilisateurs |
| GET | `/api/conversations` | Liste (dernier message, non-lus, lecture adverse) |
| POST | `/api/conversations` | Ouvrir/créer une conversation `{userId}` |
| GET | `/api/conversations/:id/messages?before=&limit=` | Historique paginé |

**Événements Socket.IO** — client → serveur : `message:send` (ack), `conversation:read`, `typing` · serveur → client : `message:new`, `messages:read`, `presence`, `typing`.

---

*Épuré par design : aucun fil d'actualité, aucune publicité, aucune distraction. Juste vos conversations.* 💬
