# Build phase

The frontend-only prototype phase ended once the API app landed. This spec captures **where we are now** and **what's still ahead**, so contributors don't have to reverse-engineer the timeline from CLAUDE.md and git history.

## Where we are now

Five apps, all deployable to Cloudflare Workers (with Static Assets for the three Next.js apps):

- **marketing** — static landing site at `/`.
- **live** — the diagram editor at `/live`. Statically exported Next.js.
- **telemetry**, public anonymous-events dashboard at `/telemetry`. Statically exported Next.js. Reads aggregate counts from the api worker's D1 events table. See [22-telemetry.md](22-telemetry.md).
- **api** — Cloudflare Worker holding the REST endpoints + Durable Object realtime room. D1 is the durable store.
- **router** — Worker that stitches the four above under one hostname.

The editor is real:

- Boxed elements (shape / text / sticky), arrows of every style (straight / curved / angled, optional label, configurable thickness + arrowhead size), groups, marquee + plain-click + shift-click multi-select.
- Format painter, per-element lock, link-to-tab, comment threads.
- Realtime presence + selection + cursor broadcast via the per-diagram Durable Object room (LWW broadcast — see [11-api.md](11-api.md)).
- Per-tab activity log with surgical revert (see [12-activity-and-audit.md](12-activity-and-audit.md)).
- Folders in the Explorer (see [15-folders.md](15-folders.md)).
- Themed templates (chosen on the `/live/new` route).
- Export the active tab as Markdown / PDF / PNG / JSON file from the header (welcome-style overlay). Import is the round-trip: a previously-exported JSON envelope drops back in as a new tab; the envelope's `schemaVersion` lets the editor refuse files newer than it understands instead of silently corrupting state.
- "Shared with you" Explorer accordion + standalone `/live/explorer` page surface the diagrams another owner has shared with the visitor; the row's link carries a still-live share code so the non-owner can actually open it. Visitor can copy a shared diagram into their own files via the header's "Make a copy" button.
- **Hybrid Clerk auth.** Guests use the editor without signing in (the spec/04 hard rule); a signed-in user's diagrams travel under their Clerk userId via Bearer-verified requests. Sign-in lives at `/live/sign-in/` (email-code OR Google OAuth), sign-up at `/live/get-started/`, account self-delete from the header menu (gated by Clerk's reverification step-up). Guest → authed migration runs on first sign-in via `POST /api/migrate`. The api worker degrades to pure guest mode when `CLERK_JWKS_URL` is unset, and the frontend ClerkProvider becomes a pass-through when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is unset — so a self-hoster can ship without Clerk (spec/03). See [04-auth-and-guest-access.md](04-auth-and-guest-access.md) and [11-api.md](11-api.md).
- **Anonymous first-party telemetry** + the public `/telemetry` dashboard. The editor emits a closed-vocabulary `{category, action, type}` event for every meaningful interaction (shapes added, themes changed, comments posted, etc.) via batched POSTs to `/api/events`; the dashboard renders aggregate counts read from the api worker's D1 summary. Off by default for self-hosters (the api's `TELEMETRY_ENABLED` flag + the live build's `NEXT_PUBLIC_TELEMETRY_ENABLED` both need to be on for events to flow end-to-end), and a per-user opt-out (spec/20) overrides both when off. See [22-telemetry.md](22-telemetry.md).

The editor never touches `localStorage` for diagrams — `apps/live/lib/api-client.ts` is the single persistence boundary. `localStorage` is only used for **identity bootstrap** (the guest participant id + name-confirmed flag — Clerk users key off their userId instead).

## Still out of scope

These are the meaningful gaps between today and "full product":

- **Transactional email** (Resend), for share notifications and account flows.
- **Operational transform / CRDT** — realtime is LWW; concurrent edits on the same element clobber.
- **Multi-user permissions beyond share links** — today a diagram is either private or shared via a link with role. No teams, no per-user grants.

## Hard rules carried forward

These were called out at prototype time and still apply:

- **Static-only frontends.** Next.js apps use `output: 'export'`. No SSR, no Node runtime, no Next.js API routes. Server logic goes in the api worker.
- **Reuse over duplication** ([CLAUDE.md](../CLAUDE.md#core-principle-reuse-over-duplication)). Shared types, UI primitives, configs, and the diagram data model live in `packages/`, never copy-pasted across apps.
- **Self-hostable.** The OSS core can run fully without any external SaaS dependency. Clerk auth is optional (see [04](04-auth-and-guest-access.md)); when it isn't configured, the worker and the live frontend degrade to pure-guest mode and the editor remains fully usable. There is no paid tier and no plan to introduce one (see [03](03-open-source-and-business-model.md)).
- **No secrets in source** — see [06-secrets-policy.md](06-secrets-policy.md).
