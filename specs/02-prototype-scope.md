# Build phase

The frontend-only prototype phase ended once the API app landed. This spec captures **where we are now** and **what's still ahead**, so contributors don't have to reverse-engineer the timeline from CLAUDE.md and git history.

## Where we are now

Four apps, all deployable to Cloudflare Workers (with Static Assets for the two Next.js apps):

- **marketing** — static landing site at `/`.
- **live** — the diagram editor at `/live`. Statically exported Next.js.
- **api** — Cloudflare Worker holding the REST endpoints + Durable Object realtime room. D1 is the durable store.
- **router** — Worker that stitches the three above under one hostname.

The editor is real:

- Boxed elements (shape / text / sticky), arrows of every style (straight / curved / angled, optional label, configurable thickness + arrowhead size), groups, marquee + plain-click + shift-click multi-select.
- Format painter, per-element lock, link-to-tab, comment threads.
- Realtime presence + selection + cursor broadcast via the per-diagram Durable Object room (LWW broadcast — see [11-api.md](11-api.md)).
- Per-tab activity log with surgical revert (see [12-activity-and-audit.md](12-activity-and-audit.md)).
- Folders in the Explorer (see [15-folders.md](15-folders.md)).
- Themed templates (chosen on the `/live/new` route).

The editor never touches `localStorage` for diagrams — `apps/live/lib/api-client.ts` is the single persistence boundary. `localStorage` is only used for **identity bootstrap** (the participant id + name-confirmed flag).

## Still out of scope

These are the meaningful gaps between today and "full product":

- **Auth** — Clerk integration. The API is open today; owner identity is carried by an `X-Owner-Id` header set by the editor to the current participant id. See [04-auth-and-guest-access.md](04-auth-and-guest-access.md).
- **Payments + email** — Stripe (Pro subscription) and Resend (transactional mail) per [03](03-open-source-and-business-model.md).
- **Operational transform / CRDT** — realtime is LWW; concurrent edits on the same element clobber.
- **Export** — PNG / SVG / JSON. The data model is JSON-serialisable already; only the route is missing.
- **Multi-user permissions beyond share links** — today a diagram is either private or shared via a link with role. No teams, no per-user grants.

## Hard rules carried forward

These were called out at prototype time and still apply:

- **Static-only frontends.** Next.js apps use `output: 'export'`. No SSR, no Node runtime, no Next.js API routes. Server logic goes in the api worker.
- **Reuse over duplication** ([CLAUDE.md](../CLAUDE.md#core-principle-reuse-over-duplication)). Shared types, UI primitives, configs, and the diagram data model live in `packages/`, never copy-pasted across apps.
- **Self-hostable.** The OSS core never depends on a SaaS endpoint at runtime. Pro features are cleanly separable from the core.
- **No secrets in source** — see [06-secrets-policy.md](06-secrets-policy.md).
