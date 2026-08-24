# Frontend sync note

## Live DB (done)
- Migration `reader_membership_user_id_canon` on Bookz
- `memberships` (8 rows backfilled), `my_access()`, `ensure_my_membership()`, `is_member()` + `invite_redeem` write memberships
- product_docs `reader-access-schema` v1

## Repo HTML
- `access.html` on this branch = live invite/OIDC page
- Full `personal.html` with `my_access()` (session ≠ member) is ready locally at:
  - agent: `/agent/repos/book-reader/personal.html`
  - source: `book_sources/v3/personal.html`
- Temporary stub may redirect to live until Hermes copies the file via deploy_stage

## Apply personal.html
Copy workspace `personal.html` over the stub, then `sh deploy_stage.sh` / prod ingest as usual.
