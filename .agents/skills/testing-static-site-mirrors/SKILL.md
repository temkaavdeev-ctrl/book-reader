---
name: testing-static-site-mirrors
description: How to locally serve and parity-test the ar1adna.com static site mirrors (matchast, book-reader) against live, incl. guest-mode expectations and known no-backend infra diffs.
---

# Testing ar1adna.com static site mirrors locally vs live

Repos: `/home/ubuntu/repos/matchast` (live: matchast.ar1adna.com) and `/home/ubuntu/repos/book-reader` (live: books.ar1adna.com). Both are pure static sites — no build step.

## Serving

- `python3 -m http.server <port> --bind 127.0.0.1` from the repo root is sufficient; zero deps.
- Absolute paths (`/app.js`, `/fonts/...`) require serving from the repo ROOT, not a subdir.

## Expected guest behavior (no login)

- matchast: boot splash with a quote → click/tap to dismiss → canvas helix star map renders from real Supabase via `matchast_public_graph` RPC (anon key in `config.js` — works unauthenticated). EN/RU toggle is appended to `.ma-tools` header; sets `?lang=` param. EN catalog is intentionally smaller (129 vs 376 materials).
- book-reader: `index.html` has an inline JS redirect to `solve-home.html` — hitting `/` or `/index.html` lands on solve-home. To see the constellation gate, use `index.html?v2=1` (shows "Система знаний о продукте" card over starfield). `explore.html` shows the guest constellation via `kb_public_graph` — populates after a few seconds (initial "0 идей" counter is a transient state, not a failure).

## Known no-backend infra diffs (NOT bugs)

- `POST /api/session` (matchast): 501 on python http.server vs 404 on live Caddy — same "no backend" outcome.
- `GET /api/me` (book-reader): 404 local vs 302→auth on live — same outcome.
- `apple-touch-icon.png`: exists in book-reader repo (200 local) but 404s on live — documented prod-side gap (PR #12); only flag it if LOCAL 404s.

## Console assertions that work well

- `document.fonts.size` → 12 on matchast.
- `performance.getEntriesByType('resource').filter(r=>r.responseStatus>=400)` for failed-asset audits.
- `navigator.serviceWorker.getRegistrations()` — SW registers on 127.0.0.1 (secure context).
- Also grep the python http.server log for `" 404` to catch assets the page requested but missed.

## Devin Secrets Needed

None — guest/anonymous surface only. Do NOT attempt real Supabase login (admin path needs real credentials).
