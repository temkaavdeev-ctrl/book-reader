# Reader access schema v1 — канон слоёв доступа (Bookz)

Владелец реализации: Гефест/Дедал. Продукт: Прометей. Источник правды: этот док + таблицы/RPC в проде.

## Зачем
Экраны access / login / Моё жили на смеси: session≈member, whitelist по email, OIDC Authelia, инвайты, локальные ★. Нужна одна схема: кто гость, кто вошёл, кто участник — и какие таблицы держат личное.

## Три слоя (не два)
1. **guest** — нет `auth.uid()`. Честный публичный слой KB (`is_public`) виден. Прогресс/★ только localStorage. CTA → `access.html`.
2. **signed_in** — есть сессия (email/password ИЛИ OIDC `custom:authelia` «Войти через ar1adna»). Ещё не участник → не пишет серверное личное; UI показывает «войти/нужно приглашение».
3. **member** — строка в `memberships(user_id)` ИЛИ (переходный fallback) email в `whitelist`. Сервер: saves, territory, MCP-токен, community/invites, path_progress.

Инвариант: **session ≠ member**. Фронт читает только `my_access()`, не `!!session`.

## Входы
| Путь | Как | Членство |
|------|-----|----------|
| Холодный гость | `access.html` state B | нет |
| Инвайт `?invite=` | state A → signup → `invite_redeem` | да (source=invite) |
| «Войти через ar1adna» | OIDC Authelia → redirect `path.html` | `ensure_my_membership` если email в whitelist |
| «Войти по почте» | `signInWithPassword` | то же |
| Админ seed | `whitelist` + ручной grant | source=admin/seed |

## Таблицы (канон личного контура)
| Таблица | Роль | Слой |
|--------|------|------|
| `memberships` | **источник истины членства по user_id** | member |
| `whitelist` | email-allowlist + админ-зеркало (не единственный ключ) | bridge |
| `profiles` | имя, invited_by, invite_balance, last_seen | member |
| `invite_links` / `invite_grants` | FR-10 инвайты | member |
| `reader_saves` | ★ Сохранённое (канон) | member; guest→local `mc:fav` |
| `reader_signals` (kind=visit) | территория / «зажжено» | member |
| `path_progress` | прогресс Пути | member |
| `kb_mcp_tokens` | персональный MCP | member |
| `card_reactions` | реакции на карточки | member |
| `kb_likes` | legacy likes (не плодить второе избранное) | deprecate→reader_saves |

Не смешивать с workshop-органом (bus/briefs/context/routines) — это другой контур той же БД.

## RPC
- `my_access()` → `{signed_in, member, email, name, role, uid}` (+ внутри `ensure_my_membership`)
- `ensure_my_membership()` → линкует whitelist-email → `memberships` после OIDC/email
- `is_member()` → memberships ∪ whitelist-email ∪ admin
- `invite_redeem(code,name)` → whitelist + **memberships** + profile
- `saves_list` / `my_territory` / `mcp_my_token*` — только member (RLS/secdef)

## Экраны → данные
- **access landing (B)** — копирайт + вкус-карточка; без auth
- **access invite (A)** — `invite_info` → регистрация
- **login** — OIDC primary, email secondary; forgot = `resetPasswordForEmail`
- **Моё guest** — баннер «листаете как гость» + Сохранённое(local) + О проекте
- **Моё member** — профиль, территория (`my_territory`), Сохранённое (`saves_list`), Сообщество, MCP

## Анти-паттерны (запрещено)
- Считать `getSession()` членством
- Писать второе избранное мимо `reader_saves`
- Давать anon мутаторы memberships/whitelist
- Плодить «Полка» как ручной дубль ★ (см. screen-personal)

## Приёмка
□ guest: honest layer без логина □ invite redeem → row в memberships □ OIDC с whitelist-email → member через ensure □ OIDC без whitelist → signed_in, не member □ Моё зовёт my_access □ saves/MCP закрыты для non-member
