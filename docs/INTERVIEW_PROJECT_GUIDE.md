# DeNote — Interview Project Guide

A full explanation of the DeNote project as you would present it to an interviewer: overview, how it works, tech choices, API flows (including JWT), real system numbers, problems we faced, and future ideas.

**Live app:** [https://denote-nu.vercel.app](https://denote-nu.vercel.app)  
**API:** [https://denote-igao.onrender.com](https://denote-igao.onrender.com)  
**OpenAPI:** [`docs/openapi.yaml`](./openapi.yaml)

---

## 1. Project overview (30-second pitch)

**DeNote** is a college notes sharing platform. Students upload academic PDFs, discover notes by subject/branch/tags, engage socially (like, favorite, comment, follow), and optionally use AI to summarize or ask questions about a document.

**Core idea:**  
- **File bytes** live on **IPFS** (via Pinata) → durable, content-addressed (`CID`).  
- **Metadata + social graph** live in **MongoDB** → searchable and relational to users.  
- **Frontend** (React) talks to **Express** with **JWT** auth.

**Who it’s for:** Campus students (email domain restricted, e.g. `@bmsce.ac.in`).

---

## 2. Main features

| Area | What users can do |
|------|-------------------|
| Auth | Register / login (email+password), Google OAuth, forgot-password OTP |
| Upload | Upload one PDF note (≤ 15 MB) with title, subject, branch, semester, tags, resource type |
| Discover | Browse, search, filter, sort; open PDF preview via IPFS gateway |
| Engage | Like (upvote), favorite, share (copy link + share count), versions |
| Collections | Group notes into packs; private or shareable public link |
| Community | Public profiles, follow/unfollow, comments, notifications, activity feed |
| Analytics | Uploader stats: views, opens, likes, favorites, shares |
| Moderation | Report notes; moderators verify/remove; admins manage roles/restrictions |
| Note AI (optional) | Summarize PDF / ask questions (off by default; free heuristic or OpenAI) |
| PWA / offline | App shell cache + IndexedDB read fallbacks for previously loaded lists |

---

## 3. How it works (end-to-end flow)

```
┌─────────────┐     HTTPS + JWT      ┌──────────────┐
│ React (Vite)│ ───────────────────► │ Express API  │
│   Vercel    │                      │   Render     │
└─────────────┘                      └──────┬───────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         ▼                  ▼                  ▼
                   MongoDB Atlas      Pinata → IPFS      Optional AI
                   (users, notes         (PDF bytes)     (heuristic /
                    meta, social)                         OpenAI)
```

### Happy path: first-time user

1. User opens the site → React SPA loads.  
2. **Register / Login** → backend validates college email → returns **JWT (7 days)**.  
3. Frontend stores token (`localStorage`) and sends `Authorization: Bearer <token>` on API calls.  
4. User **uploads a PDF** → multer receives file → SHA-256 hash for duplicates → Pinata pins to IPFS → Mongo stores `cid` + metadata.  
5. User **browses notes** → `GET /api/denote/ifps/get` returns paginated metadata → clicking a note loads detail + gateway preview URL.  
6. Optional: **Note AI** → backend fetches PDF from IPFS gateways → `pdf-parse` extracts text → summarize / answer.

---

## 4. Tech stack — what solves what

| Problem | Technology | Why this choice |
|---------|------------|-----------------|
| Interactive UI / SPA | React 18 + Vite + React Router | Fast DX, code-splitting, component model |
| REST API | Node.js + Express | Simple, good Node ecosystem for uploads/JWT |
| User + note metadata, social graph | MongoDB Atlas | Flexible documents; fits notes + nested fields |
| Store large PDFs cheaply / durably | IPFS via Pinata | Content-addressed CID; files not on app server disk |
| Auth without server sessions | JWT (7d expiry) | Stateless; works on Render free tier |
| Google sign-in | Google Identity + `google-auth-library` | Campus accounts already on Google |
| Abuse / brute force | `express-rate-limit` (in-memory) | Free-tier safe; no Redis required |
| Security headers / CORS | Helmet + CORS allowlist | Harden browser-facing API |
| PDF text for AI | `pdf-parse` + multi-gateway IPFS fetch | Local extractive AI without uploading to third parties first |
| Offline / perf | Service worker (shell only) + IndexedDB | Don’t cache private API in SW; soft offline reads |
| FE hosting | Vercel | Static SPA + CDN |
| BE hosting | Render | Long-running Node + env secrets |
| Quality / deploy | GitHub Actions CI (+ optional CD) | Tests + build on every PR; deploy hooks optional |

---

## 5. JWT — how auth works

### Issue token (login / register / Google)

1. Client `POST /api/denote/login` with username/email + password.  
2. Server verifies password (`bcrypt`), checks account not restricted/deleted.  
3. Server signs JWT with `JWT_SECRET`:

```text
payload ≈ { user: { id: "<mongoUserId>" } }
expiresIn = 7d
```

4. Response: `{ success, token, user: { username, role, ... } }`.  
5. Frontend saves `token` (and display fields) in `localStorage`.

### Use token on later requests

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Middleware (`middleware/jwt.js`):

1. Read `Authorization` header.  
2. Accept `Bearer <token>` or raw token.  
3. `jwt.verify(token, JWT_SECRET)`.  
4. Attach `req.user = { id }` for route handlers.  
5. Missing/invalid/expired → `401` with codes like `NO_TOKEN` / `INVALID_TOKEN`.

Some read routes use **optional JWT** (public browse still works; personalization if logged in).

### Why JWT here

- Render can restart anytime → no sticky server sessions needed.  
- Frontend is a separate origin (Vercel) → bearer token is a natural fit.  
- Roles (`student` → `admin`) are loaded from DB using `req.user.id` when needed (not trusting role from the client).

---

## 6. API calls — start to finish (interview walkthrough)

Base path: **`/api/denote`** (except `GET /health`).

### A) Auth sequence

| Step | Method & path | Auth | Purpose |
|------|---------------|------|---------|
| 1 | `POST /register` | No (rate-limited) | Create account (college email) |
| 2 | `POST /login` | No | Get JWT |
| 2b | `POST /auth/google` | No | Google OAuth → JWT |
| 3 | `POST /forgot-password` | No (OTP limit) | Send/reset OTP |
| 4 | `POST /reset-password` | No | Set new password with OTP |

### B) Upload note

| Step | Method & path | Auth | Purpose |
|------|---------------|------|---------|
| 1 | `POST /ifps/upload` (`multipart`, field `File_Note`) | JWT + upload limiter | Pin PDF → save note |
| — | Body fields | | title, subject, branch, sem, tags, resourceType, `forceDuplicate` |
| 2 | Response | | `{ note, cid, url, fileHash, duplicate? }` |

**Duplicate handling:** SHA-256 of file bytes. If hash exists and `forceDuplicate` is false → reject with existing note info.

### C) Browse → open → engage

| Step | Method & path | Auth | Purpose |
|------|---------------|------|---------|
| 1 | `GET /ifps/get?page=&limit=&q=&sort=` | Optional/JWT | Paginated search |
| 2 | `GET /ifps/get/:cid` | Optional/JWT | Note detail + gateway URL |
| 3 | `GET /ifps/preview/:cid` | Public | Stream/proxy preview |
| 4 | `POST /ifps/:id/like` | JWT | Toggle upvote |
| 5 | `POST /ifps/:id/favorite` | JWT | Toggle favorite |
| 6 | `POST /ifps/:id/share` | JWT | Increment share count |
| 7 | `GET /ifps/mine` | JWT | My uploads |
| 8 | `GET /ifps/favorites` | JWT | Favorites |
| 9 | `DELETE /ifps/delete` body `{ id: [...] }` | JWT | **Batch delete** (array of note ids) |

### D) Community / collections / admin / AI (high level)

- Comments: `GET/POST /notes/:noteId/comments`, edit/delete comment routes  
- Follow: `POST/DELETE /users/:username/follow`  
- Notifications: `GET /notifications`, mark read  
- Collections: `/api/denote/collections/...`  
- Analytics: `GET /me/analytics`  
- Admin: `/admin/reports`, `/admin/stats`, verify, restrict, roles  
- AI: `GET /ai/status`, `POST /ai/summarize`, `POST /ai/assist`, `POST /ai/search`, `GET /ai/recommendations`

### Example: login → upload → list (conceptual)

```text
POST /api/denote/login
  → { token }

POST /api/denote/ifps/upload
  Headers: Authorization: Bearer <token>
  multipart: File_Note=<pdf>, title=..., subject=...
  → { note: { _id, cid, ... }, url: "https://…/ipfs/<cid>" }

GET /api/denote/ifps/get?page=1&limit=12&sort=recent
  Headers: Authorization: Bearer <token>
  → { notes: [...], page, totalPages, total }
```

---

## 7. Real system numbers (from code / ops — not invented benchmarks)

Use these in interviews; they are **configured limits / observed behavior**, not fake “latency reduced by X%” claims unless you measured them in a load test.

### Upload & files

| Metric | Value | Source |
|--------|------:|--------|
| Max PDF size per upload | **15 MB** | `MAX_UPLOAD_BYTES` in `noteRoute` |
| Files per upload request | **1** (`multer.single('File_Note')`) | Current design |
| Uploads per user / hour (rate limit) | **30** | `uploadLimiter` |
| Delete many notes in one API call | **Yes** — body `id: string[]` | `DELETE /ifps/delete` |
| Duplicate detection | SHA-256 `fileHash` | Upload path |

> **Interview tip:** Today upload is **single-file**. Multi-file “one go” is a natural next feature (see §10). Batch **delete** already supports multiple IDs.

### Rate limits (in-memory, per instance)

| Limiter | Window | Max requests |
|---------|--------|-------------:|
| General API | 15 min | **300** |
| Auth (login/register/Google) | 15 min | **40** |
| OTP (forgot/reset) | 15 min | **10** |
| Upload | 60 min | **30** |

### Auth & AI / caching

| Metric | Value |
|--------|------:|
| JWT lifetime | **7 days** |
| AI PDF text cache TTL | **1 hour** (in-memory) |
| AI text cache entries | **~40** CIDs |
| Max extracted text kept | **~120,000** characters |
| IPFS gateways tried | **4+** (Pinata, ipfs.io, dweb.link, w3s.link, plus env) |
| Notes list default page size (FE) | **12** |
| AI search candidate pool | up to **200** notes |
| Offline IndexedDB soft TTL | **12 hours** |

### Observed local timings (dev smoke, not production SLA)

From earlier PDF AI testing on a real ~535 KB cheat-sheet PDF:

| Operation | Approx. time |
|-----------|-------------:|
| First summarize (fetch IPFS + parse PDF + summarize) | **~4–6 s** |
| Follow-up quiz/AI with cache warm | often **≪ 1 s** for generation after text cached |

Frontend production build splits vendors (e.g. React ~165 KB gzip ~54 KB) and lazy route chunks (NoteView, Dashboard, etc.) to keep initial load smaller.

### CI

- Backend: `npm test` (Node built-in test runner; **no DB required** for unit/HTTP smoke).  
- Frontend: `vite build` must succeed.

---

## 8. Problems faced & how we solved them

| # | Problem | Impact | Solution |
|---|---------|--------|----------|
| 1 | **PDFs on the app server** would be expensive / brittle | Disk, backups, scaling | Store files on **IPFS**; Mongo only keeps CID + metadata |
| 2 | **Anyone could register** | Noise / non-campus spam | Restrict auth to **college email domains** (+ Google domain check) |
| 3 | **OTP / secrets leaking into production** | Security risk | `OTP_HARDCODED` ignored when `NODE_ENV=production`; Helmet + rate limits |
| 4 | **Duplicate uploads** of the same PDF | Clutter | **SHA-256 file hash**; optional `forceDuplicate` |
| 5 | **Single IPFS gateway down** | Preview/AI fails | Try **multiple gateways**; skip tiny/invalid stub PDFs |
| 6 | **Study AI only used title/tags** | Bad summaries | Fetch PDF + **`pdf-parse`**; summarize from document text |
| 7 | **Phases merged into each other, not `main`** | Production missing features | Ship stacked tip to **`main`** so Vercel/Render actually deploy them |
| 8 | **Mobile nav drawer clipped** | UX bug | Drawer must sit **outside** `backdrop-filter` topbar containing block |
| 9 | **Caching APIs in service worker** | Stale/private data risk | SW caches **app shell only**; API fallbacks via **IndexedDB** |
| 10 | **Free-tier cost** | Redis/queues add $ | In-memory rate limits; AI **off by default**; heuristic provider |
| 11 | **CI `tests/**/*.test.js` broken on Actions** | False failures | Use portable glob `tests/*.test.js` |
| 12 | **Need testable Express without listen/DB** | Hard unit/smoke tests | Extract **`createApp()`** factory |

---

## 9. Architecture decisions worth defending in interviews

1. **IPFS for blobs, Mongo for queries** — don’t force Mongo to store large binaries.  
2. **JWT over sessions** — matches split FE/BE hosting.  
3. **Roles checked server-side** — client UI may hide Admin; API enforces `requireRole`.  
4. **AI is a provider interface** (`disabled` | `heuristic` | `openai`) — swap without rewriting routes.  
5. **No Redis on free tier** — accept single-instance rate-limit memory; document the trade-off.  
6. **Incremental roadmap (phases 1–10)** — ship security → content → community → moderation → analytics → AI → UX → offline → quality.

---

## 10. New features we can add next

Prioritized ideas (good “future work” answers):

1. **Multi-file upload in one request** (`multer.array` / zip) — today = 1 PDF per call.  
2. **Background pin queue** for large files + progress UI.  
3. **OCR for scanned PDFs** (image-only notes) — current AI needs extractable text.  
4. **True semantic search** (embeddings) beyond bag-of-words heuristic.  
5. **WebSocket notifications** instead of poll/refresh.  
6. **E2E tests** (Playwright) in CI against a test Mongo.  
7. **CDN image/PDF optimization** and stricter content moderation (virus scan).  
8. **Course / semester workspaces** with syllabus-linked collections.  
9. **Measured perf dashboards** (p95 API latency, upload success rate) — so you can quote real reductions.  
10. **Re-introduce Study tools** (flashcards/SR) as a separate optional module if product wants it again.

---

## 11. Resume-ready bullets (feature + how it works)

1. Built **DeNote**, a full-stack notes platform where students **upload PDFs to IPFS**, store searchable metadata in **MongoDB**, and discover notes via browse/search with likes, favorites, and collections.  
2. Implemented **JWT college-email auth** (plus Google OAuth), role-based **moderation**, social features (follow, comments, notifications), and uploader **analytics**.  
3. Added optional **Note AI** that fetches the PDF from IPFS, extracts text, and supports **summarize / Q&A**, with a free heuristic provider and optional OpenAI.  
4. Deployed on **Vercel + Render** with **GitHub Actions CI**, OpenAPI docs, rate limits, duplicate-file hashing, and offline-friendly PWA shell caching.

---

## 12. Suggested 2-minute spoken script

> “DeNote is a campus notes app. Users sign in with college email and get a JWT. When they upload a PDF, we pin it to IPFS through Pinata and save the CID and metadata in MongoDB—so files aren’t on our server disk. Other students browse and search those notes, like and favorite them, comment, follow people, and organize notes into collections. Staff can moderate reports. Optionally we turn on Note AI: the API pulls the PDF from IPFS gateways, extracts text, and can summarize or answer questions—heuristic mode costs nothing. Frontend is React on Vercel, API is Express on Render, with GitHub Actions running tests and builds. The main trade-off we designed for was free-tier constraints: no Redis, AI off by default, and careful caching so we never put private API data in the service worker.”

---

*Generated for interview prep from the DeNote codebase. Prefer citing §7 configured numbers over unmeasured performance claims.*
