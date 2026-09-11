# DeNote

DeNote is a full-stack web application for securely uploading, discovering, and studying academic notes with decentralized storage (IPFS).

**Live Demo:** [https://denote-nu.vercel.app](https://denote-nu.vercel.app)

**Backend API:** [https://denote-igao.onrender.com](https://denote-igao.onrender.com)

**OpenAPI:** [`docs/openapi.yaml`](docs/openapi.yaml) · **Testing:** [`docs/TESTING.md`](docs/TESTING.md)

---

## Overview

- Full-stack app with JWT auth, MongoDB metadata, and Pinata/IPFS file storage
- Browse, favorite, collect, comment, follow, study (flashcards / SM-2), moderate, and optional AI assist
- Free-tier oriented: no paid Redis/queues required; offline shell + IndexedDB read fallbacks on the frontend

---

## Key Features

- College-domain auth (email/password, OTP reset, Google OAuth)
- IPFS note upload, preview, versions, likes, favorites, shares
- Community: profiles, follows, comments, notifications, activity feed
- Collections (personal + share links)
- Moderation/admin roles, reports, verification, audit logs
- Study hub: decks, planner, spaced repetition, quizzes
- Optional AI (disabled / heuristic / OpenAI)
- PWA shell + IndexedDB offline cache for previously loaded lists
- Analytics for uploaders

---

## Tech Stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js, Express |
| Database | MongoDB Atlas |
| Storage | IPFS (Pinata) |
| Auth | JWT (+ Google Identity) |
| Deploy | Vercel (FE), Render (BE) |

---

## Local development

### Prerequisites

- Node.js 20+
- MongoDB URI (Atlas or local)
- Pinata JWT for uploads (optional for read-only UI work)

### Backend

```bash
cp .env.example config.env   # edit secrets
npm install
npm start                    # http://localhost:5000
curl http://localhost:5000/health
```

### Frontend

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api → :5000)
```

Important env vars (see `.env.example`):

- `MONGO_URI`, `JWT_SECRET`, `PINATA`
- `ALLOWED_EMAIL_DOMAIN` / `ALLOWED_EMAIL_DOMAINS`
- `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`
- `ADMIN_USERNAMES` (bootstrap admins)
- `AI_ENABLED`, `AI_PROVIDER` (optional)
- `OTP_HARDCODED=true` (dev only; ignored in production)

---

## Testing & CI/CD

```bash
npm test                     # node --test tests/*.test.js (unit + HTTP smoke, no DB)
cd frontend && npm run build # production bundle / code-splitting check
```

GitHub Actions:

- **CI** — tests + frontend build on pushes/PRs (`.github/workflows/ci.yml`)
- **CD** — deploy frontend (Vercel) + backend (Render) after CI succeeds on `main` (`.github/workflows/cd.yml`)

CD secrets setup: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Roadmap (stacked phases)

0. Audit → 1. Foundation/security → 2. Content platform → 3. Community → 4. Moderation → 5. Analytics → 6. Study → 7. Optional AI → 8. Frontend UX/PWA → 9. Offline + performance → **10. Quality (tests, OpenAPI, CI, docs)**

---

## Architecture Highlights

- RESTful API under `/api/denote`
- Stateless JWT auth; role ranks `student` → `admin`
- Express app factory (`createApp.js`) for testability without binding a port
- Decentralized PDFs; Mongo holds metadata and social graph
- Service worker caches app shell only (never API responses)

---

## Security & Best Practices

- Secrets via environment variables; `config.env` gitignored
- Helmet, CORS allowlist, rate limits (auth/OTP/upload/general)
- College email domain restriction
- Production ignores `OTP_HARDCODED`

---

## License

MIT — see [LICENSE](LICENSE).
