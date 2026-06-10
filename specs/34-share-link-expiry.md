# 34 — Share-link expiry

Share links ([spec/04](04-auth-and-guest-access.md), [spec/11](11-api.md)) can be given a lifetime at creation. When the lifetime runs out the link stops granting access everywhere, but stays visible to the owner in an "Inactive share links" section of the Share dialog, where it can be deleted or extended.

## Why

A share link is a capability: anyone holding the URL has the link's role forever. Expiry bounds that exposure ("share with the workshop group for a week") without the owner having to remember to revoke. It complements the share password (spec/24) as the second self-serve security control.

## Choices

At link creation the owner picks one of four lifetimes. **Never is the default** — the existing behaviour, unchanged.

| Choice   | Stored `expiry` | Lifetime         |
| -------- | --------------- | ---------------- |
| Never    | `never`         | none (no expiry) |
| 1 Week   | `week`          | 7 days           |
| 1 Month  | `month`         | 30 days          |
| 6 Months | `sixMonths`     | 183 days         |

Lifetimes are fixed ms constants (`SHARE_LINK_EXPIRY_MS` in `@livediagram/api-schema`) shared by the worker (computing `expires_at`) and the editor (rendering countdowns), so the two can't disagree.

## Data model

Migration `0020_share_link_expiry.sql` adds two nullable columns to `share_links`:

- `expiry TEXT` — the chosen lifetime token (`week` / `month` / `sixMonths`); NULL = never. Kept so **Extend** knows what duration to re-apply.
- `expires_at INTEGER` — the moment the link stops working (ms epoch); NULL = never. Set to `created_at + lifetime` at creation.

Pre-existing rows have NULL in both → never expire. The `ShareLink` DTO gains `expiry` and `expiresAt`.

## Enforcement

`getShareLink(env, code)` (the db lookup behind both access gates in `auth/diagram-access.ts`, the WebSocket-upgrade role resolution, and `GET /api/share/:code`) only returns links whose `expires_at` is NULL or in the future. One choke point, so an expired link simultaneously:

- stops resolving for visitors (the share URL and the embed view show the same not-found surface as a revoked link),
- stops authorising reads/writes carried by `X-Share-Code`,
- stops opening the realtime room.

Owner-side paths that must still see expired rows (the Share dialog's list, delete, extend) use `listShareLinks` / `getShareLinkIncludingExpired`, which don't filter. Expired rows are never auto-deleted; they remain until the owner deletes or extends them. Open realtime sessions are not force-disconnected at the expiry instant (unlike explicit revoke, which broadcasts `share-revoked`); the visitor loses access on their next load or save.

## API

- `POST /api/diagrams/:id/share` body gains optional `expiry: 'never' | 'week' | 'month' | 'sixMonths'` (default / unknown value → `never`).
- `POST /api/diagrams/:id/share/:code/extend` — owner-only. Re-arms the link: `expires_at = now + lifetime(expiry)`, where `expiry` is the duration **chosen when the link was created**. Works on active links too (pushes the deadline out from now). `400` on a never-expiring link (nothing to extend). Returns the updated link.
- `GET /api/diagrams/:id/share` (owner list) returns all links, expired included; the client splits them.

## Share dialog

- The "Create new link" row gains an expiry dropdown next to the role toggle: Never (default), 1 Week, 1 Month, 6 Months.
- **Active share links** (existing section): links with a deadline show a compact countdown chip ("6d left").
- **Inactive share links** (new section, rendered under Active only when non-empty): each expired link shows an "Expired" badge, its URL (no Copy/Embed — it doesn't work), a Delete action (same revoke endpoint), and an **Extend** action labelled with the link's creation duration ("Extend 1 week"). Extending moves the link back to Active with a fresh deadline.

## Telemetry

Reuses spec/22 vocabulary: creation keeps `Diagram/Shared/<Edit|View>` and, when a lifetime is chosen, also emits `Diagram/Shared/<ExpiryWeek|ExpiryMonth|ExpirySixMonths>`. Extend emits `Diagram/Shared/Extended`. Delete keeps the existing `Diagram/Removed/ShareLink`.

## Marketing

The landing page (spec/16) may claim expiring share links alongside the share password as the privacy/security story, since both are shipped.

## Out of scope

- Custom dates / arbitrary durations.
- Email or in-app notification before a link expires.
- Force-disconnecting live sessions at the expiry instant.
- Changing a link's lifetime after creation (delete + recreate covers it).
