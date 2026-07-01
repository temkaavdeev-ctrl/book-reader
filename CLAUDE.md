# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Closed PWA («Читальня — Управляя поведением») where invited readers work through a
book draft and improve it. **There is no build system, no package manager, no test
suite, and no framework.** The entire frontend is hand-written static HTML files with
inline `<style>` and `<script>`. The backend is Supabase (Postgres + RPC functions),
accessed directly from the browser via the CDN `@supabase/supabase-js` client. UI text
and code comments are in Russian.

## Working in this codebase

- **Editing is editing HTML files directly.** `index.html` (~10.5k lines) and
  `index-admin.html` (~11.6k lines) are single-file apps — markup, CSS, and JS all inline.
  When changing behavior, find the relevant function inside the one big `<script>` block.
- **No local run step is required or possible in a meaningful way** — it's static files.
  To preview, serve the directory over HTTP (e.g. `python3 -m http.server`) so `config.js`,
  the service worker, and relative fetches resolve. Opening via `file://` breaks the SW and
  Supabase config loading.
- **No linter/formatter/tests exist.** Match the surrounding style (compact, `var`, IIFEs,
  defensive `try{}catch(e){}` everywhere). Do not introduce a build toolchain unless asked.
- **`config.js` holds Supabase URL + `anon`/publishable key.** These are intentionally public;
  data is protected by Postgres RLS. Never commit a `service_role` key. Do not edit `config.js`
  during feature work — keys are set once and rotate independently (the SW fetches it
  network-first specifically so key rotation propagates without a cache lag).

## Architecture

### Two apps, shared backend
- `index.html` — the reader app (reading, comments, findings, quests, invites, personal menu).
- `index-admin.html` — the admin/editor app. Same Supabase project, but calls additional
  privileged RPCs (`content_approve`, `content_review_queue`, `publish_version`,
  `revert_chapter`, `guarded_set`, `cockpit`, `pult_slowdown`, `mcp_token_issue/list/revoke`,
  `kb_effectiveness`, `kb_metric_series`) and extra tables (`briefs`, `context`,
  `feature_requests`). Access is gated by RLS/role checks server-side, not by hiding the file.

### Standalone screens
`solve-home.html`, `card.html`, `explore.html`, `concepts-browse.html`, `situations.html`,
`findings.html`, `quests.html`, `access.html`, `personal.html` are independent deep-linkable
pages (the "Constellation / Матчасть" knowledge-base UI). Each one re-loads `config.js` and
creates its own Supabase client. `card.html` shows the config-load fallback pattern to copy:
it tries several relative paths (`../config.js`, `./config.js`, `config.js`,
`/book-reader/config.js`) because the app is served under a subpath on GitHub Pages.

### Data layer (Supabase)
All data access is client-side. Two styles:
- **Direct table reads/writes** via `SB.from('<table>')` — tables include `books`, `chapters`,
  `chapter_versions`, `chapter_links`, `comments`, `replies`, `comment_likes`, `reactions`,
  `ratings`, `discussions`, `decisions`, `diagrams`, `sources`, `teardowns`, `progress`,
  `profiles`, `whitelist`, `invite_links`, `quests`, `learning_events`, `reader_signals`,
  `spot_marks`, `bus`, `kb_likes`.
- **RPC functions** via `SB.rpc('<fn>')` for anything non-trivial: the knowledge-base graph
  (`kb_graph`, `kb_public_graph`, `kb_roots`, `kb_for_chapter`, `kb_findings`,
  `kb_find_similar`, `kb_search_fulltext`, `kb_atom_body`), invites
  (`invite_generate`, `invite_redeem`, `invite_revoke`, `invite_community`), stats
  (`learning_stats`, `kb_live_activity`), and MCP tokens (`mcp_my_token`,
  `mcp_my_token_rotate`). RPC responses are memoized by an in-app `installRpcCache()`.
- Supabase is initialized in `initSB()`; the client is the global `SB`, current user is `USER`.
  Raw DB rows are normalized through `mapRow()` before the UI uses them.

### Auth & membership
Email + password auth (`SB.auth.signUp` / `signInWithPassword`, **not** magic links).
Membership is invite-gated: a signup carries an invite code held in `window.__JOIN_CODE`,
and `onAuthStateChange` calls `invite_redeem` once a session is established. Email confirmation
must be **off** in Supabase (the join flow expects a session immediately after signUp).

### Offline (service worker)
`sw.js` (`constel-shell-v3`) caches the app shell, all standalone screens, and the three CDN
libs. Cardinal rule enforced there: **Supabase API traffic bypasses the SW entirely** — data
is owned by the app (IndexedDB/localStorage), never the SW cache. `config.js` is network-first;
navigations are network-first with a **per-URL** cache fallback (never fall back to `index.html`
for a deep-linked screen); CDN scripts are cache-first; other own assets are
stale-while-revalidate. Bump `VER` when changing cached shell files so clients update.

### Third-party libs (all via CDN `<script>`, no bundling)
- `@supabase/supabase-js@2` — data client
- `marked@4.3.0` — Markdown rendering of book/comment content
- `dompurify@3.4.8` — sanitize rendered Markdown before insertion

## Deploy

GitHub Pages, but **not** from the branch directly. `.github/workflows/deploy-prod.yml` runs
only on a `repository_dispatch` event of type `deploy_prod`: it downloads a prebuilt site
tarball from `client_payload.artifact_url`, unpacks it, and publishes to Pages. Pushing to a
branch does not deploy by itself — the dispatch (with an artifact URL) is the trigger. Merging
a branch into `main` via PR is how changes reach the canonical source.
