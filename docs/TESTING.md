# Testing & quality

DeNote Phase 10 adds a free-tier friendly quality baseline: unit tests, HTTP smoke tests, OpenAPI, and GitHub Actions CI.

## Commands

```bash
# Backend unit + HTTP smoke (no Mongo required)
# Uses `node --test tests/*.test.js` (single-level glob — works in GitHub Actions)
npm test

# Frontend production build
cd frontend && npm ci && npm run build
```

## What is covered

| Area | Location | Needs DB? |
|------|----------|-----------|
| College email domain rules | `tests/collegeEmail.test.js` | No |
| Roles / admin bootstrap | `tests/roles.test.js` | No |
| SM-2 spaced repetition | `tests/spacedRepetition.test.js` | No |
| Resource types / quality score | `tests/resourceTypes.test.js` | No |
| AI provider config | `tests/aiConfig.test.js` | No |
| `/health`, meta, 404, auth gate | `tests/http.smoke.test.js` | No |

HTTP smoke boots Express via `createApp()` without connecting MongoDB and without calling `app.listen` in `app.js` when imported as a module.

## API docs

Machine-readable OpenAPI 3: [`docs/openapi.yaml`](./openapi.yaml).

Import into Swagger UI, Stoplight, or Postman as needed.

## CI

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

- `backend-test` — `npm ci` + `npm test`
- `frontend-build` — `frontend` install + `vite build`

## CD

Workflow: [`.github/workflows/cd.yml`](../.github/workflows/cd.yml) — deploys to Vercel + Render after CI succeeds on `main`.

Setup (secrets): [`docs/DEPLOY.md`](./DEPLOY.md).

## Manual / offline checks

Phase 9 offline IndexedDB + service worker behavior is verified manually (or with a local Puppeteer smoke). CI does not register a service worker against production gateways.

## Adding tests

1. Prefer pure functions under `utils/` for new unit tests (`node:test` + `node:assert/strict`).
2. Keep tests free of paid services (no Redis, no paid OpenAI calls).
3. For authenticated route coverage that needs Mongo, document the fixture approach in the PR; prefer not blocking CI on Atlas availability.
