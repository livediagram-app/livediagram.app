# User preferences

Per-user editor preference flags that toggle behaviour without
changing diagram content. Most are exposed through a small
Settings dialog launched from the footer (gear button to the left
of the dark-mode toggle); a small number are per-tool toggles
that live next to the tool they affect (see the UI placement
section below) rather than in Settings. Either way the
persistence model is the same. Replaces the earlier
per-diagram-settings shape: preferences are about the user's
editor experience, not about any particular diagram, so they live
once per account / device and apply everywhere.

## Where preferences live

Preferences live in **D1** as the source of truth, with
`localStorage` as a fast warm cache so the editor never blocks on
a network round-trip at boot.

- **D1 table** `user_preferences` (migration `0016_user_preferences.sql`),
  one row per owner (Clerk userId for signed-in users, the per-
  browser participant id for guests). Columns: `owner_id TEXT
PRIMARY KEY`, `prefs TEXT NOT NULL` (serialised JSON blob),
  `updated_at INTEGER NOT NULL` (Unix ms). The JSON blob shape
  keeps the migration count low when new flags arrive: adding a
  field never requires altering the table.
- **localStorage cache** keyed `livediagram:user-preferences:v1`
  (legacy key, unchanged). Read synchronously at page-load so the
  Settings dialog and gate caches (telemetry, draw-to-add, etc.)
  have a value to read before the network fetch returns.

### Sync flow

- **On editor open**: read the localStorage cache synchronously
  (zero-blocking), then fire-and-forget `GET /api/preferences`.
  When the server response arrives, merge it over the cache
  (server wins for any key present on both sides), persist back
  to localStorage, and dispatch the existing
  `livediagram:preferences-changed` window event so in-process
  listeners refresh. If the fetch fails the cache value stays
  authoritative for the session.
- **On toggle**: update localStorage immediately (so the UI
  reflects the change without waiting for the network), then
  fire-and-forget `PUT /api/preferences` with the full updated
  blob. If the PUT fails the local change still applies; the
  next page load picks the cache again. Last-write-wins per
  device.
- **Cross-tab updates**: the browser's native `storage` event on
  the preferences key still fires across tabs in the same
  browser, so toggling in one tab updates every open editor.

### Why D1 instead of localStorage-only

The original v1 shape was localStorage-only on the grounds that
flags were UI-only and a server round-trip per toggle was
overkill. That trade-off was wrong for the user experience:
signed-in users who use livediagram on a laptop and a phone had
to re-flip every setting on each device. Per-account sync is the
expected behaviour for an account-bound app.

Guests get the same persistence model (the api keys them by
their `X-Owner-Id` participant id), so server-side storage is
effectively a remote copy of localStorage for that device, but
with a cross-browser bonus: a guest who clears localStorage but
keeps the same browser session still recovers their preferences.

### Sign-up migration

`POST /api/migrate` (spec/04) moves `user_preferences.owner_id`
along with the diagrams + folders + shared-with rows, so a guest
who signs up keeps the settings they'd already chosen. Idempotent
in the same shape as the existing migrations: a second call with
the same `guestOwnerId` moves zero rows.

### Self-host degradation

When the api worker is unset (pure-guest self-host without a D1
binding configured) the client treats the fetch as a no-op
failure: the localStorage cache acts as the only persistence,
which is the same behaviour as the original v1 design and works
exactly like it did before. No required SaaS calls, self-hosting
stays viable.

## Schema

```ts
type UserPreferences = {
  // When false, the live editor skips the "re-pin connected arrow
  // anchors as elements move" pass implemented in packages/diagram's
  // `rebindArrowAnchorsAfterMove` (pinned in
  // packages/diagram/src/geometry.test.ts). Defaults to true so
  // users see the magic by default; flipping it off freezes arrow
  // anchors at whatever the user chose at draw time.
  autoRebindArrows?: boolean;

  // When false, the live editor's `track()` helper is a no-op:
  // nothing leaves the browser. Distinct from the build-time
  // NEXT_PUBLIC_TELEMETRY_ENABLED gate and from the api worker's
  // TELEMETRY_ENABLED gate (both still apply). This is the user's
  // own opt-out lever, surfaced in the Settings dialog so the
  // "first-party, no creepy tracking" claim on the landing page
  // and /telemetry is honest. Defaults to true (telemetry on);
  // setting it to false is the only state that changes behaviour.
  // See spec/22 for the rest of the telemetry contract.
  telemetryEnabled?: boolean;

  // When true, picking a shape (or tool) from the palette enters
  // a draw-to-size mode: the canvas cursor becomes a shape-aware
  // crosshair and the next drag defines the bounds of the new
  // element. Defaults to false (the historical drop-at-viewport-
  // centre behaviour). See `apps/live/lib/draw-mode.ts` for the
  // PendingDraw discriminated union the gesture commits through.
  drawToAdd?: boolean;
  // Pencil tool's shape-recognition toggle (spec/09 Pencil
  // subsection). When true, every freehand commit while the
  // pencil banner is up runs through recogniseShape and may
  // mint a primitive instead of a FreehandElement. Deliberately
  // NOT surfaced in the Settings dialog: the flag is a per-tool
  // toggle, set + read from the pencil ModeBanner's icon button,
  // and Settings is reserved for global editor preferences. The
  // toggle's state still persists here so flipping it once
  // sticks across sessions.
  recogniseShapes?: boolean;
};
```

Stored as serialised JSON on both sides of the wire. Unknown keys
are preserved on read so a forward-rolled client doesn't strip
another version's flags.

## Defaults

Missing key === undefined === default behaviour. Concretely:

- `autoRebindArrows` undefined → arrows rebind (the default
  behaviour). Setting it to `false` is the only state that
  changes behaviour.
- `telemetryEnabled` undefined → telemetry on (the default).
  Setting it to `false` is the only state that opts out.
- `drawToAdd` undefined → drop-at-centre placement (the default).
  Setting it to `true` flips the palette into draw-to-size mode
  for every element kind.
- `recogniseShapes` undefined → raw-sketch pencil (the default).
  Setting it to `true` makes every pencil commit attempt
  classification first. Flipped from the pencil ModeBanner icon
  button rather than from the Settings dialog.

Empty (or missing entirely) localStorage entry, AND no row in
`user_preferences` for this owner, is therefore the "everything
on" state.

## UI placement

Global preferences (auto-rebind, telemetry, draw-to-add) sit in
the Settings dialog. Per-tool preferences (today: `recogniseShapes`
for the pencil) sit next to the tool they affect, because
walking the user back to a separate dialog to flip a per-tool
behaviour is friction the tool's banner already solves.

- **Settings dialog**: `apps/live/components/SettingsDialog.tsx`,
  lazy-loaded via `next/dynamic` (matches the other on-demand
  modals: ShareDialog, ExportTabDialog, ShortcutsDialog,
  ImagePicker). Trigger: a gear-icon button in the TabBar footer,
  sitting between the existing Shortcuts button and the dark-mode
  toggle. Visible in every role: view-role visitors can still
  flip their own telemetry preference and (harmlessly) their own
  auto-rebind preference, even though they can't edit elements.
- **Per-tool surfaces**: today only the pencil's ModeBanner (a
  sparkle / magic-wand icon button to the left of Cancel) carries
  the `recogniseShapes` toggle. The button reads the value from
  the lifted `userPreferences` state in editor-page and writes
  through `writeUserPreferences` with the resolved owner id, so
  the round-trip is identical to a Settings dialog flip. See
  spec/09's Shape-recognition subsection for the user-visible
  contract.

## Read / write helpers

Live in `apps/live/lib/user-preferences.ts`:

- `readUserPreferences(): UserPreferences` returns the current
  cached preferences, parsing the stored JSON and defaulting any
  missing key. Returns `{}` on parse failure (graceful). Sync,
  reads localStorage only, so the editor can use it during render.
- `writeUserPreferences(prefs, ownerId?): void` serialises and
  writes back to localStorage AND, when `ownerId` is supplied,
  fires a non-blocking `PUT /api/preferences` so the value
  round-trips to D1. Also dispatches a
  `livediagram:preferences-changed` window event so same-tab
  listeners (notably `lib/telemetry.ts`) can refresh their cached
  gate without polling. Callers without an `ownerId` (unit tests,
  the editor before identity resolves) skip the network step and
  still get the localStorage write; the next call with an
  ownerId catches D1 up.
- `fetchUserPreferences(ownerId): Promise<UserPreferences | null>`
  does a single `GET /api/preferences` for the resolved owner,
  merges the server's value over the localStorage cache (server
  wins on conflict), writes the merged blob back to localStorage,
  and dispatches `livediagram:preferences-changed`. Returns the
  merged preferences, or null on failure / when the api worker
  is unreachable (the caller can treat that as "stick with the
  cache"). Called once at editor mount.

Cross-tab updates are picked up via the browser's native `storage`
event on the preferences key.

## API

- **`GET /api/preferences`** — returns `{ prefs: UserPreferences }`
  for the resolved owner. Empty object when no row exists. Auth:
  the standard hybrid identity (Clerk Bearer OR `X-Owner-Id`).
- **`PUT /api/preferences`** — body `{ prefs: UserPreferences }`,
  upserts the row for the resolved owner. Returns 204. The blob
  is opaque to the api worker beyond a size cap (4 KB; defends
  against runaway clients). No per-field validation: the client
  is responsible for the shape, and a malformed client just
  reflects malformed prefs back to itself.
