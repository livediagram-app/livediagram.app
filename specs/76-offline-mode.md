# 76 — Offline Mode

**Offline Mode** lets you create a diagram that is saved **only in the current
browser** — never to the API, never to the server. It's an opt-in choice at
creation, not the default. It suits private/local-first work, air-gapped or
no-account use, and anyone who wants a diagram that physically never leaves
their machine. It also reinforces the OSS promise (spec/03): the editor is fully
usable with the API _and_ auth switched off.

This is a **deliberate, permanent choice for a diagram**, not a temporary
network state. (Handling a transient dropped connection on a _cloud_ diagram is
a separate concern — see spec/75 — and out of scope here.)

## Turning it on

Offline Mode is **off by default**. You choose it when creating a diagram:

- The **New Diagram** wizard (spec/14) runs three steps: Template, Theme, then
  **Settings**. The Settings step carries the **"Save Offline, This Browser
  Only"** toggle, alongside the diagram name and where it is saved (a personal
  folder or a team library). Off = a normal cloud diagram (today's behaviour);
  on = the new diagram is created offline.
- The toggle carries a one-line caveat inline (_"When enabled your diagram is
  only stored within your Web Browser storage."_), and turning it on reveals a
  data-loss warning and disables the folder / team placement, so the durability
  trade-off is set at the moment of choice.
- The template and theme choices work identically; the toggle only changes
  _where the diagram is stored_.

No global "offline mode" switch: the choice is **per diagram**, so a person can
have cloud diagrams and offline diagrams side by side.

## Where offline diagrams live

- Stored in **IndexedDB** in the browser (roomy + async; `localStorage`'s ~5 MB
  synchronous cap is too small for image-bearing diagrams). One record per
  diagram holds its meta + tabs, keyed by the diagram id.
- The app keeps a small **local index** of offline diagram ids (also in
  IndexedDB) so the Explorer can list them and the persistence layer knows which
  ids resolve locally vs to the API.
- **Durability honesty (important).** An offline diagram has **no backup**:
  clearing site data, some private-browsing sessions, and browser
  storage-pressure eviction can delete it. We request
  `navigator.storage.persist()` to reduce eviction risk, and we surface the
  trade-off plainly — at the toggle, on the diagram (see the badge), and in the
  help article. "Offline" means _yours only_, with the responsibility that
  implies.

## What's different in an offline diagram

The diagram model (`Tab[]` + meta, per spec/05) is **identical** — an offline
diagram is a normal diagram whose persistence target is IndexedDB instead of the
API. The full editor works: shapes, arrows, sketches, layers, tabs, links,
templates, themes, undo/redo, export. What changes are the features that
_require the server_, which are hidden or gated (not broken) for an offline diagram:

| Feature                  | Offline behaviour                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Share links / embeds     | The header **Share** button stays visible, but for an offline diagram it opens a gate prompting you to sync to your account first (nothing lives on a server to share yet). Read-only embeds are unavailable for the same reason (spec/07, /54). |
| Live presence / realtime | N/A — a private diagram never opens the room anyway (spec/75).                                                                                                                                                                                   |
| Teams / shared library   | Hidden — a team library is server-side (spec/32, /35).                                                                                                                                                                                           |
| Comments                 | Local-only (just you), stored in the diagram; no cross-user.                                                                                                                                                                                     |
| AI assistance            | Works online — it reads the current canvas, not the stored diagram (spec/25); only a lost connection stops it.                                                                                                                                   |
| Activity / change log    | Local-only, kept in the diagram record; no server history.                                                                                                                                                                                       |
| Duplicate                | Makes **another offline diagram** — a copy never uploads what the user chose to keep local.                                                                                                                                                      |
| Folders                  | Personal-tree placement stored in the record; team moves are impossible (the shared library is server-side).                                                                                                                                     |
| Tab linking (spec/17)    | Unavailable in either direction — linked tabs are one shared server row.                                                                                                                                                                         |
| Thumbnails               | A fixed **offline illustration** in the Explorer — there's no server snapshot (spec/54).                                                                                                                                                         |
| Images                   | **Embedded locally** — see below.                                                                                                                                                                                                                |

**Images embed locally (spec/19).** In a cloud diagram, an added image uploads
to R2 and is referenced by URL. In an offline diagram it can't — so an image is
stored **inline as a `data:` URI** inside the diagram. Rendering is unchanged
(`<img>` reads a data URI fine). This costs local storage, which is the accepted
trade for staying fully offline. (Conversion re-homes images — see below.)

Autosave still runs for an offline diagram (spec/13) — it writes to IndexedDB
instead of the API, and the "Saved" indicator means _saved on this device_.

## "Offline" badge + Explorer

The word **"Offline"** identifies these diagrams everywhere the status is shown:

- **Editor header badge.** Today the status pill reads Private / Shared / Team
  (the `SharedBadge` in `EditorHeader`). For an offline diagram it reads
  **"Offline"** (a new state that supersedes "Private" for these diagrams), with
  its own tone + icon, and a tooltip restating _"Saved only in this browser."_
- **Explorer.** Offline diagrams appear in **Recent** (and the other lists)
  alongside cloud diagrams. The full-page Explorer marks each with an
  **"Offline"** visibility badge; every surface (panel + full page) shows the
  fixed offline thumbnail, so a local-only diagram is recognisable at a glance.
  The Explorer view merges the API-fetched cloud list with the local index of
  offline diagrams; offline rows never trigger a server fetch (list, thumbnail,
  or otherwise).

## Converting between Offline and Cloud

Conversion works **both directions**, from the Explorer row menu (in both the
in-editor panel and the full-page Explorer). In the editor, the offline to cloud
direction is also offered by the Share dialog's offline gate (opening Share on an
offline diagram prompts you to sync first).

### Save to server (Offline → Cloud)

Action: **"Sync Diagram"** (Explorer row menu) or **"Sync to Account"** (the Share
dialog gate).

- Uploads the diagram's meta + tabs to the API (spec/11), creating a normal
  cloud diagram owned by the current identity (signed-in account, or the guest
  `X-Owner-Id` if not signed in — spec/04).
- **Images:** embedded `data:` URIs travel with the tab JSON, so the cloud copy
  renders them as-is. Re-homing them to R2 (and, on take-offline, downloading R2
  images to embed) is a follow-up — the current cut moves the diagram, not the
  image storage layer (spec/19).
- On success the **local copy is removed** from IndexedDB so there's one source
  of truth; the diagram is now a cloud diagram (Share / AI / Teams reappear). The
  id is unchanged, so the route stays the same: the editor reloads to re-hydrate
  it as a cloud diagram.

### Take offline (Cloud → Offline)

Action: **"Take Offline"**. This is **destructive on the server** and gated by a
confirmation:

- **Confirmation** warns clearly: _"This removes the diagram from your account
  and every other device. It will exist only in this browser, with no backup."_
- On confirm: download the diagram's tabs + meta into IndexedDB, register it in
  the local index, then **delete the server record** (via a raw delete so the
  now-offline id isn't re-routed to the local store) and any share links. The
  badge flips to **Offline**. (R2 images keep their URLs for now — downloading +
  embedding them is the same follow-up noted above.)
- Because it deletes the cloud copy, taking a _shared_ or _team_ diagram offline
  first revokes those (a share/team diagram can't be pulled private silently);
  the confirmation spells this out.

## Auth / guest interaction

Offline Mode is independent of sign-in:

- Works **signed-in or guest**. An offline diagram is browser-local regardless of
  account — a signed-in user's offline diagrams do **not** appear on their other
  devices (that's the point).
- It differs from a **guest cloud** diagram (spec/04): a guest's cloud diagram is
  anonymous but still on the server (keyed by the browser's participant id);
  an offline diagram never touches the server at all.
- Sign-in / sign-out never migrates offline diagrams (the migrate flow, spec/04,
  only moves guest _cloud_ diagrams to the account). Offline diagrams stay put.

## Persistence architecture

The editor already has a **single persistence boundary**: `apps/live/lib/api-client.ts`
(a barrel over `lib/api/*`); nothing in the editor calls `fetch` directly. Offline
Mode is implemented **behind that boundary** so the editor is unaware of the
target:

- Introduce a small **persistence-backend interface** (load / save / list /
  create / delete / etc. for diagrams + tabs) with two implementations:
  **`ApiBackend`** (today's `fetch` calls) and **`LocalBackend`** (IndexedDB).
- Dispatch per diagram: an id in the local index → `LocalBackend`; otherwise
  `ApiBackend`. Offline ids are client-generated (`crypto.randomUUID`).
- Only the diagram/tab CRUD path needs the local backend; server-only endpoints
  (share, teams, room ticket, thumbnails) are simply never called for an offline
  diagram (the UI gates them).

This keeps the change contained to the persistence seam plus UI gating, rather
than threading a mode flag through the editor.

## Marketing (spec/16, /23)

Offline Mode is **folded into the existing privacy / security area** of the
landing page — no standalone section. It appears as a short point plus a small
inline illustration/icon, framed as local-first:

> **Work fully offline.** Create diagrams that never leave your browser — no
> account, no server, no sync. Yours alone.

The illustration is a small local-first glyph (a browser/device with a diagram
inside, "no cloud"), consistent with the existing privacy iconography
(spec/23). It links to the help article below.

## Help centre (spec/55)

Add a help article **"Offline Mode"** (under a saving / privacy-oriented
category), and — per the help-registry rule — **register it in
`apps/help/lib/articles.ts`** in the same change (slug, title, description,
category, `categorySlug`, and bump the category `articleCount`). The article
covers:

- What Offline Mode is and how to create one (the New Diagram toggle).
- That it's **this-browser-only**: not synced, not backed up, and can be lost if
  you clear site data — the durability warning, stated plainly.
- **Converting**: "Sync Diagram" (Offline → Cloud) and "Take Offline"
  (Cloud → Offline, which deletes the server copy).
- What's unavailable offline: sharing, live collaboration, teams, and AI.

Also add the standard contextual help link (spec/56) from the New Diagram toggle
to this article.

## Telemetry (spec/22)

Track adoption without content, reusing the closed vocabulary:

- On create, distinguish the mode via the `type` on the existing
  `Diagram`/`Created` event (e.g. `Offline` vs `Cloud`).
- On conversion, a coarse event for each direction (types like `SavedToCloud` /
  `TakenOffline`), so uptake and the destructive take-offline path are visible.
- No diagram content or ids ever leave (the `type` bound in spec/22 holds).

## Non-goals

- **No cross-device sync of offline diagrams** — that would defeat the purpose;
  sync is exactly what the cloud path is for.
- **No collaborative offline editing** — offline is single-user by nature.
- **Not** offline-resilience for cloud diagrams (editing a cloud diagram through
  a network blip) — that's spec/75's territory.
- **No automatic promotion** — a diagram never silently moves between offline and
  cloud; every conversion is an explicit, user-initiated action.

## Implementation map

- `apps/live/lib/api-client.ts` + `lib/api/*` — the persistence-backend seam;
  new `LocalBackend` (IndexedDB) beside the existing API calls; per-diagram
  dispatch via a local index.
- New Diagram wizard (`TemplatePicker` / `template-picker-settings.tsx`,
  spec/14): the **Settings** step's "Save Offline, This Browser Only" toggle +
  data-loss warning + contextual help link.
- `EditorHeader` (`SharedBadge`) — the new **Offline** badge state.
- Explorer (row + card components, `VisibilityBadge`): merge the local index,
  show the **Offline** badge in the full-page Explorer plus a fixed offline
  thumbnail everywhere, and skip server fetches for offline rows. (The in-editor
  panel row shows the thumbnail but no text chip.)
- Conversion actions (Explorer row menu + the Share dialog's offline gate):
  "Sync Diagram" / "Sync to Account" and "Take Offline" (with confirmation +
  image re-homing).
- Image handling (spec/19) — embed `data:` URIs offline; upload-on-save,
  download-on-take-offline.
- `apps/marketing` — the privacy-area mention + small asset (spec/16, /23).
- `apps/help` — the "Offline Mode" article + its `articles.ts` registry entry
  (spec/55).
- Telemetry — the create `type` + conversion events (spec/22).

## References

See [spec/03](03-open-source-and-business-model.md) (no required SaaS),
[spec/04](04-auth-and-guest-access.md) (auth / guest),
[spec/05](05-diagram-structure.md) (diagram model),
[spec/11](11-api.md) (api + persistence),
[spec/13](13-per-tab-storage.md) (per-tab storage + autosave),
[spec/14](14-new-diagram-route.md) (New Diagram),
[spec/16](16-marketing-site.md) + [spec/23](23-marketing-assets.md) (landing),
[spec/19](19-images.md) (images),
[spec/22](22-telemetry.md) (events),
[spec/55](55-help-app.md) + [spec/56](56-contextual-help-links.md) (help),
[spec/75](75-realtime-conflict-resolution.md) (realtime — the separate concern).
