# Offline Mode

**Offline Mode** lets you create a document that is saved **only in the current
browser** — never to the API, never to the server. It's an opt-in choice at
creation, not the default. It suits private/local-first work, air-gapped or
no-account use, and anyone who wants a document that physically never leaves
their machine. It also reinforces the OSS promise ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)): the editor is fully
usable with the API _and_ auth switched off.

This is a **deliberate, permanent choice for a document**, not a temporary
network state. (Handling a transient dropped connection on a _cloud_ document is
a separate concern — see [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) — and out of scope here.)

Tab bodies are stamped with their **board kind** on the way into IndexedDB (`upsertTab`), exactly as the cloud path stamps them in `tabForWire` — the two stores must agree about what a tab IS, or a Sync Document would hand the cloud a board that has forgotten itself ([Event storming](../021-event-storming/event-storming.md)).

## Turning it on

Offline Mode is **off by default**. You choose it when creating a document:

- The **New Document** wizard ([Dedicated route for new-document creation](../007-editor/new-document-route.md)) runs three steps: Template, Theme, then
  **Location** (the Settings step in code). It carries the **Save location** chooser
  ([Save Locations](save-locations.md)), alongside the document name and where it is saved (a personal
  folder or a team library). **livediagram** (the default) = a normal cloud
  document; **Local Browser** = the new document is created offline.
- The Local Browser tile is captioned _"This device only"_, and choosing it
  reveals a data-loss warning and removes the folder / team step (there is
  nothing to choose), so the durability trade-off is set at the moment of
  choice.
- The template and theme choices work identically; the location only changes
  _where the document is stored_.

No global "offline mode" switch: the choice is **per document**, so a person can
have cloud documents and offline documents side by side.

## Where offline documents live

- Stored in **IndexedDB** in the browser (roomy + async; `localStorage`'s ~5 MB
  synchronous cap is too small for image-bearing documents). One record per
  document holds its meta + tabs, keyed by the document id.
- The app keeps a small **local index** of offline document ids (also in
  IndexedDB) so the Explorer can list them and the persistence layer knows which
  ids resolve locally vs to the API.

<!-- legacy-names -->

- **Store rename (version 2).** Offline documents were kept in the `diagrams` object store until
  the container became a document ([Document](document.md#renaming-from-diagram)). Opening
  version 2 of `livediagram-offline` moves every record into `documents` inside the upgrade
  transaction, then drops the old store, logging how many moved
  (`apps/live/lib/offline/legacy-offline-store.ts`). A tab still running the code from before the upgrade
  asks for version 1, which the browser refuses once another tab has opened version 2; its offline
  documents are out of reach in that tab until it reloads.
- **Durability honesty (important).** An offline document has **no backup**:
  clearing site data, some private-browsing sessions, and browser
  storage-pressure eviction can delete it. We request
  `navigator.storage.persist()` to reduce eviction risk, and we surface the
  trade-off plainly — at the chooser, on the document (see the badge), and in the
  help article. "Offline" means _yours only_, with the responsibility that
  implies.

<!-- /legacy-names -->

## What's different in an offline document

The document model (`Tab[]` + meta, per [Document structure](document-structure.md)) is **identical** — an offline
document is a normal document whose persistence target is IndexedDB instead of the
API. The full editor works: shapes, arrows, sketches, layers, tabs, links,
templates, themes, undo/redo, export. What changes are the features that
_require the server_, which are hidden or gated (not broken) for an offline document:

| Feature                                                                   | Offline behaviour                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Share links / embeds                                                      | The header **Share** button stays visible, but for an offline document it opens a gate prompting you to sync to your account first (nothing lives on a server to share yet). Read-only embeds are unavailable for the same reason ([Live app](../007-editor/live-app.md), /54). |
| Live presence / realtime                                                  | N/A — a private document never opens the room anyway ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)).                                                                                                                                    |
| Teams / shared library                                                    | Hidden — a team library is server-side ([Teams](../013-workspace/teams.md), /35).                                                                                                                                                                                               |
| Comments                                                                  | Local-only (just you), stored in the document; no cross-user.                                                                                                                                                                                                                   |
| AI assistance                                                             | Works online — it reads the current canvas, not the stored document ([AI Assistance](../007-editor/ai-assistance.md)); only a lost connection stops it.                                                                                                                         |
| Activity / change log                                                     | Local-only, kept in the document record; no server history.                                                                                                                                                                                                                     |
| Duplicate                                                                 | Makes **another offline document** — a copy never uploads what the user chose to keep local.                                                                                                                                                                                    |
| Folders                                                                   | Personal-tree placement stored in the record; team moves are impossible (the shared library is server-side).                                                                                                                                                                    |
| Tab linking ([Tab ↔ document many-to-many](tab-document-many-to-many.md)) | Unavailable in either direction — linked tabs are one shared server row.                                                                                                                                                                                                        |
| Thumbnails                                                                | A fixed **offline illustration** in the Explorer — there's no server snapshot ([Live image share link](../013-workspace/live-image-share.md)).                                                                                                                                  |
| Images                                                                    | **Embedded locally** — see below.                                                                                                                                                                                                                                               |

**Images embed locally ([Image element + per-owner gallery](../009-elements/images.md)).** In a cloud document, an added image uploads
to R2 and is referenced by URL. In an offline document it can't — so an image is
stored **inline as a `data:` URI** inside the document. Rendering is unchanged
(`<img>` reads a data URI fine). This costs local storage, which is the accepted
trade for staying fully offline. (Conversion re-homes images — see below.)

Autosave still runs for an offline document ([Per-tab storage](per-tab-storage.md)) — it writes to IndexedDB
instead of the API, and the "Saved" indicator means _saved on this device_.

## "Offline" badge + Explorer

The word **"Offline"** identifies these documents everywhere the status is shown:

- **Editor header badge.** Today the status pill reads Private / Shared / Team
  (the `SharedBadge` in `EditorHeader`). For an offline document it reads
  **"Offline"** (a new state that supersedes "Private" for these documents), with
  its own tone + icon, and a hover card restating _"Saved only in this browser."_
- **Explorer.** Offline documents appear in **Recent** (and the other lists)
  alongside cloud documents. The full-page Explorer marks each with an
  **"Offline"** visibility badge; every surface (panel + full page) shows the
  fixed offline thumbnail, so a local-only document is recognisable at a glance.
  The Explorer view merges the API-fetched cloud list with the local index of
  offline documents; offline rows never trigger a server fetch (list, thumbnail,
  or otherwise).

## Converting between Offline and Cloud

Conversion works **both directions**, from the Explorer row menu (in both the
in-editor panel and the full-page Explorer). In the editor, the offline to cloud
direction is also offered by the Share dialog's offline gate (opening Share on an
offline document prompts you to sync first).

### Save to server (Offline → Cloud)

Action: **"Sync Document"** (one name everywhere: the Explorer row menu and the
Share dialog gate).

- Uploads the document's meta + tabs to the API ([API app](../015-api/api.md)), creating a normal
  cloud document owned by the current identity (signed-in account, or the guest
  `X-Owner-Id` if not signed in — [Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Images re-home:** each embedded `data:` URI is uploaded to the gallery
  (SHA-256 dedupe server-side, [Image element + per-owner gallery](../009-elements/images.md)) and the element's reference swaps to
  the returned R2 id, so the cloud copy carries real gallery images instead of
  bloated tab JSON. A failed transfer keeps the data URI (it still renders
  anywhere); the per-tab byte cap surfaces a hard failure to the caller.
- **Everything on the record travels**, not just tabs: the slide deck
  ([Presentation mode](../012-collaboration/presentation-mode.md)), the created date, the folder (kept only when it is one of the
  caller's own personal folders, else Unsorted) and the star ([Favourite documents](../013-workspace/favourites.md)). The
  local copy is deleted next, so anything the create leaves behind is gone.
- **A forked tab comes back as its own tab.** The create never writes into a tab
  another document holds: a seeded tab whose id is already taken outside this
  document is created under a fresh id, and the document's tab / element links and
  deck slides follow it. So a tab that forked on Take Offline returns as a new
  tab beside the original rather than overwriting it; joining them again is an
  explicit "Add to Document". A retried create (the tab already in this document)
  keeps its ids.
- On success the **local copy is removed** from IndexedDB so there's one source
  of truth; the document is now a cloud document (Share / AI / Teams reappear). The
  id is unchanged, so the route stays the same: the editor reloads to re-hydrate
  it as a cloud document.

### Take offline (Cloud → Offline)

Action: **"Take Offline"**. This is **destructive on the server** and gated by a
confirmation:

- **Confirmation** warns clearly: _"This removes it from your account and every
  other device. It will exist only in this browser, with no backup."_ When the
  document has shared tabs, the shared-tab notice follows (see below).
- On confirm: download the document's tabs + meta into IndexedDB, register it in
  the local index, then **delete the server record** (via a raw delete so the
  now-offline id isn't re-routed to the local store) and any share links. The
  badge flips to **Offline**. Referenced R2 images are downloaded and embedded
  as `data:` URIs BEFORE the server copy is deleted (the deletion would make
  them "unused" and the retention reaper would eventually take the bytes); an
  incomplete embed aborts the conversion and the document stays on the server.
- **The deck, star and personal folder come along** for the same reason: the
  server row they live on is about to be deleted. A team document's folder is a
  team folder, which has no place in the personal tree, so it lands in Unsorted.
- **Shared tabs fork.** A tab also linked into other documents
  ([Tab ↔ document many-to-many](tab-document-many-to-many.md)) is not taken
  away from them: the server delete keeps it there whole, history included, and
  the offline copy holds its own copy of the content. From then on the two are
  independent; an edit on either side never reaches the other. The
  confirmation says so up front (see [Shared-tab notice](tab-document-many-to-many.md#shared-tab-notice)).
- **Every tab, or nothing.** If any tab fails to download the conversion aborts
  before anything is written locally and before the server delete, so the cloud
  copy stays authoritative. This is the one failure in this direction that
  nothing could undo: a partial download followed by the server delete leaves
  the missing tab's elements nowhere at all, while reporting success. A tab read
  can come back empty from two directions — a failed request, or a 404 that the
  api client maps to `null` rather than an error — and both count as failure
  here. (The best-effort "keep what loaded" shape is right for _duplicating_ a
  document, where the source survives; it inverts once the source is destroyed.)
- **If that server delete fails, the local copy is rolled back** and the error
  surfaces. Both copies registered under one id would shadow the live cloud
  document behind a stale offline fork (and duplicate the Explorer row), so the
  conversion is all-or-nothing in this direction too. Data-safe either way: the
  server still holds everything, and the user can retry. The rollback is
  best-effort, but a rollback that itself fails still reports the original
  delete failure rather than a success.
- **Take Offline bypasses the [Trash](../013-workspace/trash.md)** for the document's owner: it is a move, not a delete, so the server copy goes at once. A joined teammate taking a team document offline sends the team's copy to the team Trash instead, since from the team's side it is a deletion.
- **Deleting an offline document moves it to this browser's local Trash** ([Trash](../013-workspace/trash.md), "The local Trash"): the IndexedDB record gains `trashedAt` and keeps everything else, leaves the lists and stars, refuses writes, and is purged 30 days later the next time the app lists documents or opens the Trash. Sync Document removes the local record outright (a move, like Take Offline).
- Because it deletes the cloud copy, taking a _shared_ or _team_ document offline
  first revokes those (a share/team document can't be pulled private silently);
  the confirmation spells this out.

## Auth / guest interaction

Offline Mode is independent of sign-in:

- Works **signed-in or guest**. An offline document is browser-local regardless of
  account — a signed-in user's offline documents do **not** appear on their other
  devices (that's the point).
- It differs from a **guest cloud** document ([Auth + guest access](../014-identity/auth-and-guest-access.md)): a guest's cloud document is
  anonymous but still on the server (keyed by the browser's participant id);
  an offline document never touches the server at all.
- Sign-in / sign-out never migrates offline documents (the migrate flow, [Auth + guest access](../014-identity/auth-and-guest-access.md),
  only moves guest _cloud_ documents to the account). Offline documents stay put.

## Persistence architecture

The editor already has a **single persistence boundary**: `apps/live/lib/api-client.ts`
(a barrel over `lib/api/*`); nothing in the editor calls `fetch` directly. Offline
Mode is implemented **behind that boundary** so the editor is unaware of the
target:

- **Dispatch per call, not a backend pair.** This was first drafted as two
  implementations of one interface, an `ApiBackend` and a `LocalBackend`. What
  shipped is smaller: each load / save / delete in `lib/api/*` opens with
  `if (await isOfflineId(id))` and hands off to `lib/offline/offline-store.ts`,
  otherwise it does what it always did. There is no second class to keep in
  step with the first, and an endpoint that offline has no answer for simply
  never grows the branch.
- Offline ids are client-generated (`crypto.randomUUID`) and registered in a
  local index; `isOfflineId` reads it. The `beforeunload` beacon flush cannot
  await, so it uses the synchronous `isOfflineIdSync` off the loaded cache.
- **Listing is the exception that is not a dispatch.** The Explorer shows both
  sets at once, so it MERGES the api list with the local one, and still returns
  the offline rows when the cloud fetch fails.
- **Create is the one caller-decided branch**, because there is no registered id
  to dispatch on yet: the New Document wizard calls `offlineCreateDocument`
  directly when the author picked Local Browser, and that call is what registers
  the id every later operation routes on.
- Only the document/tab CRUD path needs the local store; server-only endpoints
  (share, teams, room ticket, thumbnails) are simply never called for an offline
  document (the UI gates them).

This keeps the change contained to the persistence seam plus UI gating, rather
than threading a mode flag through the editor.

## Marketing ([Marketing site](../019-marketing/marketing-site.md), /23)

Offline Mode is **folded into the existing privacy / security area** of the
landing page — no standalone section. It appears as a short point plus a small
inline illustration/icon, framed as local-first:

> **Work fully offline.** Flip on Offline Mode when you create a document and it is saved only in
> your browser: no account, no server, no sync. Yours alone. Move it to the cloud (or pull one
> back down) whenever you like.

The illustration is a small local-first glyph (a browser/device with a document
inside, "no cloud"), consistent with the existing privacy iconography
([Marketing assets](../019-marketing/marketing-assets.md)). It links to the help article below.

## Help centre ([Help app](../018-help/help-app.md))

Add a help article **"Offline Mode"** (under a saving / privacy-oriented
category), and — per the help-registry rule — **register it in
`apps/help/lib/articles.ts`** in the same change (slug, title, description,
category, `categorySlug`, and bump the category `articleCount`). The article
covers:

- What Offline Mode is and how to create one (the New Document wizard's Save
  location chooser, [Save Locations](save-locations.md)).
- That it's **this-browser-only**: not synced, not backed up, and can be lost if
  you clear site data — the durability warning, stated plainly.
- **Converting**: "Sync Document" (Offline → Cloud) and "Take Offline"
  (Cloud → Offline, which deletes the server copy).
- What's unavailable offline: sharing, live collaboration, teams, and AI.

Also add the standard contextual help link ([Contextual help links](../018-help/contextual-help-links.md)) from the New Document
wizard's data-loss warning to this article.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Track adoption without content, reusing the closed vocabulary:

- On create, distinguish the mode via the `type` on the existing
  `Document`/`Created` event (e.g. `Offline` vs `Cloud`).
- On conversion, a coarse event for each direction, so uptake and the
  destructive take-offline path are visible: `Document`/`Moved` with type
  `SavedToCloud` or `TakenOffline`, emitted from the shared
  `useOfflineConversion` handlers after the conversion succeeds and before
  the reload (the telemetry engine's pagehide beacon carries it through).
- No document content or ids ever leave (the `type` bound in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) holds).

## Non-goals

- **No cross-device sync of offline documents** — that would defeat the purpose;
  sync is exactly what the cloud path is for.
- **No collaborative offline editing** — offline is single-user by nature.
- **Not** offline-resilience for cloud documents (editing a cloud document through
  a network blip) — that's [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)'s territory.
- **No automatic promotion** — a document never silently moves between offline and
  cloud; every conversion is an explicit, user-initiated action.

## Implementation map

- `apps/live/lib/api-client.ts` + `lib/api/*` — the persistence-backend seam;
  new `LocalBackend` (IndexedDB) beside the existing API calls; per-document
  dispatch via a local index.
- New Document wizard (`TemplatePicker` / `template-picker-settings.tsx`,
  [Dedicated route for new-document creation](../007-editor/new-document-route.md)): the **Settings** step's Save location chooser ([Save Locations](save-locations.md), the
  Local Browser tile) + data-loss warning + contextual help link.
- `EditorHeader` (`SharedBadge`) — the new **Offline** badge state.
- Explorer (row + card components, `VisibilityBadge`): merge the local index,
  show the **Offline** badge in the full-page Explorer plus a fixed offline
  thumbnail everywhere, and skip server fetches for offline rows. (The in-editor
  panel row shows the thumbnail but no text chip.)
- Conversion actions (Explorer row menu + the Share dialog's offline gate):
  "Sync Document" and "Take Offline" (with confirmation + image re-homing).
- Image handling ([Image element + per-owner gallery](../009-elements/images.md)) — embed `data:` URIs offline; upload-on-save,
  download-on-take-offline.
- `apps/marketing` — the privacy-area mention + small asset ([Marketing site](../019-marketing/marketing-site.md), /23).
- `apps/help` — the "Offline Mode" article + its `articles.ts` registry entry
  ([Help app](../018-help/help-app.md)).
- Telemetry — the create `type` + conversion events ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)).

## References

See [Open source + distribution](../002-project-scope/open-source-and-business-model.md) (no required SaaS),
[Auth + guest access](../014-identity/auth-and-guest-access.md) (auth / guest),
[Document structure](document-structure.md) (document model),
[API app](../015-api/api.md) (api + persistence),
[Per-tab storage](per-tab-storage.md) (per-tab storage + autosave),
[Dedicated route for new-document creation](../007-editor/new-document-route.md) (New Document),
[Marketing site](../019-marketing/marketing-site.md) + [Marketing assets](../019-marketing/marketing-assets.md) (landing),
[Image element + per-owner gallery](../009-elements/images.md) (images),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) + [Contextual help links](../018-help/contextual-help-links.md) (help),
[Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) (realtime — the separate concern),
[Save Locations](save-locations.md) (the Save location chooser).
