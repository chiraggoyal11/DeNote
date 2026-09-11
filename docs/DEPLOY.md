# Deploy (CD)

DeNote can deploy from **GitHub Actions** after CI passes on `main`.

Platforms:

| App | Host | CD mechanism |
|-----|------|----------------|
| Frontend | Vercel | `vercel deploy --prebuilt --prod` |
| Backend | Render | Deploy Hook (`POST` URL) |

Workflow: [`.github/workflows/cd.yml`](../.github/workflows/cd.yml)

- Triggers when the **CI** workflow completes successfully on `main`
- Also supports **Actions → CD → Run workflow** (manual)

CI itself stays in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (tests + frontend build). CD does not replace Vercel/Render Git integrations — you can keep those on, or turn them off and let Actions be the only deployer to avoid double deploys.

---

## 1) Frontend secrets (Vercel)

In GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | How to get it |
|--------|----------------|
| `VERCEL_TOKEN` | [Vercel → Account Settings → Tokens](https://vercel.com/account/tokens) → create token |
| `VERCEL_ORG_ID` | `vercel link` in `frontend/`, then read `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | same file → `projectId` |

Local helper:

```bash
cd frontend
npx vercel login
npx vercel link   # select the DeNote frontend project
cat .vercel/project.json
```

If these secrets are missing, the CD job **skips** with a warning (does not fail the workflow).

---

## 2) Backend secret (Render)

| Secret | How to get it |
|--------|----------------|
| `RENDER_DEPLOY_HOOK_URL` | Render → your DeNote API service → **Settings → Deploy Hook** → create hook → copy URL |

The CD job `POST`s that URL after CI succeeds. If the secret is missing, the job skips with a warning.

---

## 3) Recommended production settings

**Render env** (already used by the app): `MONGO_URI`, `JWT_SECRET`, `PINATA`, `ALLOWED_EMAIL_DOMAIN`, optional `AI_ENABLED=true`, `AI_PROVIDER=heuristic`, `ADMIN_USERNAMES`, etc. See [`.env.example`](../.env.example).

**Avoid double deploys**

- Option A: Disable Render “Auto-Deploy” and Vercel Git deploy; use Actions CD only  
- Option B: Keep platform auto-deploy; leave Actions secrets empty (CD skips)  
- Option C: Use Actions CD + disable only one side

---

## 4) Verify

1. Merge to `main` (or run **CD** manually)
2. Wait for **CI** → green
3. **CD** should run `Deploy frontend (Vercel)` and `Deploy backend (Render)`
4. Check [denote-nu.vercel.app](https://denote-nu.vercel.app) and `GET https://denote-igao.onrender.com/health`
