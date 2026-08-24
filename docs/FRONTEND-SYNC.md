# Frontend sync note

## Live DB (done)
- Migration `reader_membership_user_id_canon` on Bookz
- `memberships` (8 rows backfilled), `my_access()`, `ensure_my_membership()`, `is_member()` + `invite_redeem` write memberships
- product_docs `reader-access-schema` v1

## Repo HTML
- `access.html` on this branch = live invite/OIDC page
- `personal.html` on this branch = full Моё with `my_access()` (session ≠ member)
  - guest banner / signed_in-not-member banner / member profile+territory+saves
  - source mirror: `book_sources/v3/personal.html`

## Deploy
After merge: Hermes `deploy_stage.sh` / prod ingest as usual (or GitHub Actions deploy-prod).
