# Access scheme — books.ar1adna.com

Identity is not membership. Three states, one door.

## States

| State | How it is decided | What is open |
| --- | --- | --- |
| Guest | no session | honest layer / foundation (`path.html?ch=m1-osnovy`, public cards) |
| Signed in | Authelia OIDC session (PKCE via supabase-js) | same public layer; Моё says membership still needs an invite |
| Member | `is_member()` after whitelist / `invite_redeem` | progress, saves, reactions, MCP, community |

`my_access()` / `is_member()` are admin **or** a `memberships` row **or** email on `whitelist`. A session token alone is not membership. `mc-auth.js` is the shared organ: it must not set `__MEMBER` from a session cookie.

## Doors

1. **Public mouth:** `landing.html`. «Войти» goes to `access.html?view=login`. Does not start OAuth itself.
2. **One auth surface:** `access.html`.
   - Invite (`?invite=` / `?join=`): accept with Authelia; redeem after the session exists.
   - Login (`?view=login`): Authelia primary. Email/password is collapsed legacy for accounts already created in the book.
   - Cold guest: invite-only copy, login link, no second product door.
3. **Account:** `personal.html` (Моё). Guest CTA → login. Signed-in-not-member → invite page, not a fake profile.

Post-auth home is `path.html` (Путь), not `solve-home.html`. Live `path.html` is an alias onto the reader monolith `index.html` (query/hash preserved) so the URL exists; Caddy already treats `/path.html` as volatile.

## OIDC

Provider: `custom:authelia` (issuer `https://auth.ar1adna.com`).

The client **must** call `supabase.auth.signInWithOAuth({ provider: 'custom:authelia', options: { redirectTo } })`. PKCE is enabled on the provider. A raw `/auth/v1/authorize?provider=…` URL cannot complete PKCE and must not appear in HTML.

`redirectTo` returns to `access.html` (keeps `?invite=`). Invite code and optional name sit in `sessionStorage` (`mc:invite`, `mc:invite-name`) across the Authelia hop.

After a session exists, `membership_after_auth(p_code, p_name)`:

- ensures `profiles`
- redeems the invite when a code is present (`invite_redeem`)
- returns `{ ok, member, redeemed, name, invite_error }`

Granted to `authenticated` only.

## Authelia / JWT

`current_email()` reads `auth.jwt()->>'email'`. OIDC must put email on the user / JWT or whitelist match fails. Authelia redirect URI is the Supabase callback, not the book origin.

This repo does not store Authelia client secrets. Do not print them.

## What this does not change

- Live publish is two copies of the same overlay: (1) Bookz `prod-artifact` ingest + `deploy-prod` → GitHub Pages; (2) the same files onto the Caddy root `/var/www/books` (host `books.ar1adna.com`). Git `book-reader` `main` can lag the live tree; do not replace the live tarball with the git checkout. Do not wipe the Caddy tree.
- Email linking of an OIDC identity to a pre-existing book email account is unverified.
- Remaining never-list items of Ariadna proper are out of scope.
