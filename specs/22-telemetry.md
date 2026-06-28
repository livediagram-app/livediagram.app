# 22, Telemetry + public transparency dashboard

First-party, anonymous product analytics, surfaced on a **public** dashboard so anyone can see what we measure. The goal: understand which features get used so we know what works, while staying honest about the product's "no creepy tracking" stance.

## Principles

- **Anonymous, aggregate, first-party.** Events carry no user id, no IP, no user-generated content (never a diagram name, tab name, participant name, element text, share code, or diagram id). Only a fixed, app-defined vocabulary of enum values is ever stored.
- **No external vendors.** Ingestion is our api worker; storage is our existing D1 database; the dashboard is our own app. Nothing is sent to a third party, and data is never sold or shared beyond the public dashboard.
- **Off by default.** A single env var gates the whole system, so OSS self-hosters and forks emit/serve nothing unless they opt in. This keeps the "no required SaaS calls" rule ([03](03-open-source-and-business-model.md)) intact.
- **Transparent.** The dashboard is public (`/telemetry`), and the privacy policy + landing page say plainly what we capture and why, and link to it.

## Event schema

Every event is three small fields (`packages/api-schema`, shared by emitter + ingest so they can't drift):

```ts
type TelemetryEvent = {
  category: TelemetryCategory; // the "parent": Diagram | Element | Tab | Theme | Canvas | Template | Comment | Note | Search | UI | Folder | Session | AI | Team | Participant | Help | Token
  action: TelemetryAction; // the "verb": Created | Deleted | Shared | Joined | Added | ...
  type?: string | null; // one app-defined reference value: 'Square', 'Edit', 'PNG', a template id, a theme name
};
```

Examples: `{category:'Diagram', action:'Created'}`, `{category:'Diagram', action:'Shared', type:'Edit'}`, `{category:'Diagram', action:'Joined', type:'Edit'}`, `{category:'Element', action:'Added', type:'Square'}`.

`category` and `action` validate against closed enums. `type` is a bounded set of app-defined values (shape kinds, share roles `Edit`/`View`, export formats, template ids, theme names) — all presets, never UGC. The ingest endpoint rejects values outside the allowed sets, so the public dashboard can only ever show known, safe strings.

## Storage (existing D1)

A new `events` table on the **existing** `DB` database (migration `apps/api/migrations/0015_*`), deliberately not a separate database so self-hosters who already provisioned `DB` get telemetry with zero extra setup:

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  action   TEXT NOT NULL,
  type     TEXT,
  ts       INTEGER NOT NULL  -- ms epoch
);
CREATE INDEX idx_events_ts ON events (ts);
```

No owner/IP column — rows are anonymous by construction. If write volume ever outgrows D1, the migration path is Workers Analytics Engine (write-optimised, same Cloudflare account, no new vendor); the ingest + summary contract stays the same.

## Retention

The dashboard surfaces three fixed windows that top out at **30 days** (Last month). Rows older than that are dead storage: never read, never aggregated, never user-visible. The api worker's `scheduled` handler runs a daily **60-day sweep** at 03:00 UTC that deletes events older than the retention floor (twice the dashboard's longest window, so a future "Last 60 days" expansion would have data to populate). Symmetric with the existing 90-day `change_log` retention (spec/12); both fire on the same cron, dispatched on `event.cron`. Self-hosters with `TELEMETRY_ENABLED` off never accumulate events in the first place, so the sweep is a no-op for them.

## API

- **`POST /api/events`** — ingest. Body `{ events: TelemetryEvent[] }` (batched). Validates each against the schema; inserts the valid ones with a server-stamped `ts`. Returns 204. **Deliberately exempt from the diagram write-rate-limiter** so a busy editor session's telemetry can never eat into / block a user's real diagram saves; client-side batching keeps request volume low. Anonymous (no auth required); no body field is stored beyond the three enums + ts. When telemetry is disabled, no-ops with 204.
- **`GET /api/telemetry/summary`** — the dashboard's only data source. Returns grouped counts for three **fixed** windows so the queries stay simple and the response is cacheable: **Today** (since UTC midnight), **Last 7 days**, **Last 30 days** ("Last month"). No custom ranges. Shape:
  ```ts
  {
    enabled: boolean;
    generatedAt: number;
    windows: {
      today: Window;
      last7: Window;
      last30: Window;
    };
    // 30 zero-filled UTC-day buckets oldest -> newest, pre-aggregated
    // server-side so the dashboard's trend charts render without any
    // client work. Optional: absent in the disabled-state response so
    // older clients still parse, present whenever `enabled` is true.
    daily?: {
      days: number[];                       // UTC-midnight ms per bucket
      totals: number[];                     // total events that day
      byCategory: Record<string, number[]>; // per-category counts, same indexing
      byMetric: Record<string, number[]>;   // per-event counts, same indexing; key = `category|action|type`
    };
  }
  // Window = { total: number; rows: { category; action; type; count }[] }
  ```
  `byMetric` is the per-event (category·action·type) version of `byCategory` —
  one 30-day series per distinct event, keyed `category|action|type` (empty
  string for a null `type`). It drives the Search view's metric trend line so a
  single event can be charted over time, not just a whole category. Same
  zero-filled indexing as `days`/`totals`/`byCategory`.
  Cached at the edge (Cache API, a few minutes) so a public traffic spike never hammers D1. When disabled, returns `{ enabled: false }`. The cache is bypassed when the worker is serving from a localhost hostname (parallel to the same-origin escape hatch), so a developer iterating on the feature sees fresh counts immediately instead of waiting out a 5-minute TTL per emit.

## On/off env var

`TELEMETRY_ENABLED` (worker, `wrangler.toml [vars]`, default off) is **authoritative**: it gates both `POST /api/events` and `GET /api/telemetry/summary`. The live editor also reads `NEXT_PUBLIC_TELEMETRY_ENABLED` (baked at build) to avoid emitting at all when off — a client optimisation; the server flag is the real gate. Both absent → fully off, which is the self-host default. On top of these, each user has a per-device opt-out flag stored alongside the other user preferences (spec/20, `telemetryEnabled`, default true). When that flag is false, `track()` is a no-op for that browser regardless of the server's stance; this is the user-facing lever the landing page and `/telemetry` reference when they say "first-party, no creepy tracking".

## Abuse controls

`POST /api/events` is public + unauthenticated by design, so it's guarded in layers without identifying users (it's anonymous trend data, not billing — the goal is "not worth it" + protect cost, not "impossible"):

- **Closed vocabulary.** Events are validated against the `category`/`action`/`type` enums and the batch is capped (100), so an attacker can only ever inflate counts of _known_ events — never inject arbitrary strings into the public dashboard or store junk.
- **Per-IP rate limit.** A dedicated `EVENTS_RATE_LIMITER` binding (separate from the diagram `WRITE_RATE_LIMITER`, so it never touches real users) keyed on `CF-Connecting-IP` — which the client can't forge, unlike `X-Owner-Id`. 120 batches/60s/IP: generous for a real session, bounding for a flood. The IP is a transient key, never stored. Degrades to "allow" when the binding is absent (self-host).
- **Same-origin filter.** A request whose `Origin` header is present and isn't this site is dropped (silently, 204), which stops casual cross-origin / drive-by posting. Spoofable by curl, which the rate limit then catches. Localhost origins (any port) are mutually allowed so local dev (live editor on `:3002` posting to the api worker on `:8787`) actually reaches D1; production never sees a localhost origin, so this widening is dev-only in practice.
- **Cloudflare edge.** Automatic DDoS protection fronts the worker for free. **Recommended manual step:** add a WAF rate-limiting rule on `path eq /api/events` keyed by IP in the Cloudflare dashboard — it blocks abuse _before_ the worker runs (so it costs nothing per blocked request and never touches D1). This is the strongest, cheapest lever and is dashboard config, not code; hosted-only, so forks add their own.

Residual risk: a distributed botnet across many IPs could still nudge the numbers. Accepted — that's a lot of effort to juice an anonymous usage chart. If it ever matters, a global daily insert ceiling is the backstop.

## Emitting (live editor only)

A `track(category, action, type?)` helper in `apps/live/lib` buffers events and flushes them batched on an interval and on `visibilitychange`/unload via `navigator.sendBeacon`. Fire-and-forget; failures are swallowed (telemetry must never affect the editor). Gated by `NEXT_PUBLIC_TELEMETRY_ENABLED`. Instrumented only in the **editor** (`apps/live`), never the static marketing site, so the marketing "0 trackers" claim stays literally true. Call sites are one-liners, e.g. `track('Element', 'Added', 'Square')`.

The aim is to cover every meaningful interaction a person has with a diagram (discrete feature actions, never continuous gestures like drag/resize/pan/zoom or raw colour tweaks, which would just be noise). Current taxonomy:

- **Diagram**: Created; Shared `Edit`/`View`/`PasswordSet`/`PasswordCleared`; Joined `Edit`/`View`; Duplicated (also `Copy` when a visitor clones a shared diagram into their own account); Removed `ShareLink` (a share link revoked — counterpart to Shared); Deleted; Exported `Markdown`/`PDF`/`PNG`/`SVG`/`JSON`; Renamed; Undone; Redone; Moved (to a folder, or back to Unsorted when folder=null); Reverted (single entry rolled back from the activity log).
- **Element**: Added `<shape kind | Text | Sticky | Arrow | Image | Freehand | TableColumn | TableRow>` (the `TableColumn`/`TableRow` types are a column/row inserted into a table element); Deleted (no type for a plain element delete — covering both single and marquee-multi delete — or `TableColumn`/`TableRow` when a table column/row is removed, `Eraser` when the eraser tool wipes it); Duplicated; Grouped (both the marquee-group and the drag-one-onto-another group-tool path); Ungrouped; Locked; Unlocked; Linked; Unlinked; Reordered `Front`/`Back`/`TableColumn`/`TableRow`; Rotated `<shape kind | Text | Sticky | Image | Freehand>` (emitted once at rotate-gesture start, boxed elements only — arrows don't rotate); Toggled `Bold`/`Italic`/`Underline`/`Strikethrough`/`AspectLock`/`TableHeaderRow`/`TableHeaderColumn`/`TableZebra`; Changed `FormatPainter` (style copied from a source onto a target), `Font`, `TextSize`, `TextAlign`, `Padding`, `ShapeMorph`, `BorderStroke`, `BorderStyle`, `BorderRadius`, `ArrowEnds`, `ArrowThickness`, `ArrowheadSize`, `ArrowheadShape`, `ArrowStyle`, `ArrowLineStyle`, `TableCell`; Voted (a dot-vote cast on an element, spec/39). The `Freehand` type corresponds to the pencil tool (spec/09). Per-element **colours** (fill / stroke / text) and **opacity** are deliberately NOT tracked — those are the "raw colour tweaks" the rule above carves out.
- **Tab**: Created; Deleted; Duplicated; Renamed; Locked; Unlocked; Linked; Reordered; Imported `JSON`/`Markdown`; Aligned; Cleared; Changed `Font`/`DefaultTextSize`; Started `CountdownTimer`/`StopwatchTimer`/`Vote` (a live session tool launched on the tab, spec/39); Ended `Vote`; Revealed `Vote`.
- **Theme**: Changed `<theme label>`/`ResetElements` (the "Reset elements to theme" action force-recolours every element on the tab to the active theme); Created `Custom`; Changed `CustomEdited`; Deleted `Custom` (the custom-theme builder lifecycle).
- **Canvas**: Changed `<background pattern>`/`BackgroundColor`/`BackgroundOpacity`/`PatternColor`; Zoomed `In`/`Out`/`Fit`/`Reset`; Used `Laser` (entered the laser / presenter tool — emitted on entering the mode, not per trail sample). The `BackgroundColor` / `BackgroundOpacity` / `PatternColor` emits are debounced ~800ms per slider so a single drag collapses to one event rather than dozens (carved-out exception to the "raw colour tweaks are noise" rule, justified because a debounced single-emit captures the discrete "user changed canvas appearance" signal without flooding).
- **Template**: Used `<template kind>`.
- **Comment**: Added; Deleted; Resolved; Unresolved; Opened (user opened the comment popover on an element). View-role visitors can Add and Delete **their own** comments, but not Resolve / Unresolve or delete others'. Their Add goes through the dedicated `POST /api/diagrams/<id>/tabs/<tabId>/comments` endpoint and their Delete through `DELETE /api/diagrams/<id>/tabs/<tabId>/comments/<commentId>` (server-checked `authorId === caller`); both accept read-role auth (the only write paths open to view-role; spec/11).
- **Note**: Added (transition empty -> non-empty); Changed (existing note's text edited); Deleted (transition non-empty -> empty); Opened (user opened the note popover on an element). One Add/Change/Delete emit per save (popover commit), not per keystroke; a save that doesn't change the text emits nothing.
- **Search**: Opened (panel mount); Searched (query first becomes non-empty in a session, debounced to one emit per panel open so per-keystroke noise stays out); Selected `Diagram`/`Shared`/`Folder`/`Team`/`Tab`/`Element` (user picked a result, type = the result kind).
- **UI**: Toggled `Dark`/`Light` (editor chrome mode toggle, distinct from per-tab diagram theme), the Settings-dialog flips `AutoRebindOn`/`AutoRebindOff` / `TelemetryOn`/`TelemetryOff` / `MinimalPanelsOn`/`MinimalPanelsOff` (see spec/20), and the per-tool flip `RecogniseShapesOn`/`RecogniseShapesOff` (the pencil ModeBanner toggle, also spec/20, surfaced beside the tool rather than in Settings), `AlignmentGuidesOn`/`AlignmentGuidesOff` (spec/20), `ReduceMotionOn`/`ReduceMotionOff` (spec/20), `NotificationsOn`/`NotificationsOff` (the Settings flip for confirmation toasts, spec/20), and `ZenModeOn`/`ZenModeOff` (the distraction-free focus mode, spec/26). The type carries the new value so the dashboard reads as "users moved this way" rather than "users touched a setting". Also: Opened `Settings`/`Shortcuts`/`Share`/`Activity` (the editor's modal dialogs and the activity panel); Closed `Welcome` (user dismissed the first-run welcome modal); the keyboard-shortcuts master flip `ShortcutsOn`/`ShortcutsOff` (the per-device toggle in the Shortcuts dialog that disables every editor shortcut, spec/07); Copied `ShareLink` (clicked the copy button on a share link); Copied `EmbedCode` (copied a share link's iframe snippet from the Share dialog, spec/33); Copied `TeamInviteLink` (copied a team invite link from the Invite-by-link dialog, spec/32). The `TelemetryOff` flip fires BEFORE the preference is persisted so the opt-out itself still reaches the wire; the other preference flips do too so the wire event matches the value the user just clicked, not the prior state.
- **AI**: Used `<mode>` (where `<mode>` is `Ask` or `Clean` — the two remaining modes after `generate`/`review` were removed, spec/25). Fires on each successful request after the response is received / streaming completes; off-topic refusals don't inflate the count. Toggled `AiOn`/`AiOff` (the Settings opt-in for the AI panel). See spec/25.
- **Folder**: Created; Renamed; Deleted; Moved (re-parented under another folder, or promoted to the root when parent=null). Tracked from `useFolders` so both the editor side panel and the standalone explorer page emit identically; rename emits only when the trimmed name actually changes.
- **Team**: Created; Joined (accepted an email invite or opened an invite link); Shared `Link` (an admin turned on a shareable invite link, spec/32); Removed `Link` (that invite link turned off), `Invite` (a pending email invite withdrawn), `Member`/`Self` (a member removed, or the user left the team); Changed (team settings edited), `Role` (a member's Admin/Member role changed); Added `Member` (invited a member by email), `Diagram` (a diagram added to / moved within a team library); Moved `Diagram`; Deleted (the team disbanded). Membership only — see spec/32.
- **Session**: SignedIn (user just completed sign-in via Clerk); SignedUp (just completed sign-up); SignedOut (just signed out) — these only fire when Clerk is configured; pure-guest deploys emit nothing here. Opened `Embed` (a read-only embed view rendered, spec/33; one emit per iframe document).
- **Participant**: Created (a brand-new browser identity was minted — the daily new-visitors signal). Fires exactly once per browser, at whichever identity mint runs first: the local guest-id mint (`ensureGuestSelfId`, used by `/new` + `/explorer`) or the server-signed mint (`ensureSignedGuestIdentity`, the editor bootstrap); a returning browser hits the stored-id early-returns and never re-emits. First-time visitors who sign up without ever minting a guest id surface via `Session`/SignedUp instead. No type, no identifier — the event is a bare count.
- **Token**: Created `Manual` (an API token minted by hand from the Explorer New-token popover, via `useTokens.create`) or `Created` `MCP` (an AI tool connected through the OAuth consent screen, spec/62, which mints a token under the hood); Removed (a token revoked, `useTokens.revoke`). The `type` is the fixed source only — never the token, its name, or the client name.

Extend by adding to the `TELEMETRY_CATEGORIES` / `TELEMETRY_ACTIONS` enums (if needed) + a one-line `track()` call at the interaction's handler. Page hits are deliberately not wired; new-visitor counting goes through `Participant`/Created above.

## Dashboard app (`apps/telemetry`)

A new Next.js static-export app (same stack as the others), mounted by the router at **`/telemetry`** (`basePath: '/telemetry'`, prefix stripped by the router, like the live app's assets). Public, read-only.

A **global timeframe panel** sits above the view tabs and is shared by every tab (the window is not tab-specific): three selectable cards (Today / Last 7 days / Last month) each show that window's total and act as the filter, with the selected window highlighted on a 30-day daily **trend line** directly below — so the reader controls the filter and sees the volume line in one always-visible place. The selected window drives the counts in all three tabs.

Below it, three top-level **view tabs** switch between ways of reading the single `GET /api/telemetry/summary` payload:

- **Highlights** (default) — the key product metrics we most want to watch, **grouped into the questions they answer** (Visitors, Creation, Collaboration, Output & Preferences), each a card with the selected-window count, a plain-language description, and a 30-day mini trend line. A fixed curated list, not "top by volume", so a low-volume but important signal (a first-time visitor, `Participant·Created`) is always on screen. A highlight is either a single typed event or an **aggregate** over every type of a `category·action` (e.g. all `Element·Added` shapes, all `Diagram·Exported` formats) where the type split is arbitrary for that lens — but stays type-specific where the type is meaningful (Edit vs View share links; the Dark UI toggle, which shares `UI·Toggled` with unrelated setting flips). Metrics absent from the payload render as zero rather than vanishing.
- **Raw** — the full aggregate view: a category-share **donut** (legend below) and a top-N **leaderboard** side by side, then every event in the window as a **sortable, category-filterable table** (category badge, event, count + share with bar, 30-day trend sparkline). Click a header to sort; the Category funnel narrows to a chosen subset.
- **Look & Feel** — which visual presets get used, most to least: ranked lists of templates (`Template·Used`), built-in themes (`Theme·Changed`), and canvas patterns (`Canvas·Changed`), each with first/last tagged Most / Least used, plus the custom-theme builder's lifecycle (created / applied / edited / deleted).
- **Search** — find one specific metric two ways: **type** a query for flat token matches, or **browse** the hierarchy (category → action → type) one level at a time, for when you can't name what you want. Selecting a metric **visualises it underneath** as its own 30-day trend line (from `daily.byMetric`, with the selected window highlighted) plus its Today / Last 7 / Last month totals.

Charts render in inline SVG (a line with a shaded selected-window span and a dashed average reference line); no charting library, no extra request. Event names display in Title Case (preserving acronyms like PNG/JSON). Explains in-page that the data is anonymous, first-party, no vendors. Degrades to an "analytics not enabled" state when the summary returns `enabled: false`.

## Routing & deploy

- **Router** ([08](08-router-app.md)): a `TELEMETRY` service binding and a `/telemetry` route that strips the prefix and forwards (mirrors the live-asset strip).
- **Deploy** ([10](10-deployment.md)): build + upload `apps/telemetry/out`, a `deploy-telemetry` job in parallel with marketing/live/api, and `deploy-router` gains it as a dependency. The `events` migration applies in the existing `wrangler d1 migrations apply DB` step.

## Provisioning (one-time, owner only)

1. Apply the migration: `wrangler d1 migrations apply DB --remote` (the deploy workflow already does this).
2. Set `TELEMETRY_ENABLED = "true"` in `apps/api/wrangler.toml [vars]` (and `NEXT_PUBLIC_TELEMETRY_ENABLED=true` for the live + telemetry builds) to turn it on. Leaving them unset keeps telemetry off — the self-host default.

## Privacy posture

The privacy policy + landing page state: we record anonymous, first-party product events (the three-field schema, examples), to learn which features help; no external analytics vendors; data is never sold or shared beyond the public `/telemetry` dashboard. This is consistent with the existing "no tracking pixels / no third-party analytics" claims — those remain true (first-party, anonymous, no third parties, no ad tracking).
