# Save Locations

The New Document wizard's third step ([Dedicated route for new-document creation](../007-editor/new-document-route.md), [Offline Mode](offline-mode.md); `settings` in code,
its chip reads **Location**) asks **where a new document is stored**. Until now that question was a single iOS-style toggle,
"Save Offline, This Browser Only", which could only ever answer yes or no: on
the server, or in this browser. More stores may come (GitHub is plausible), and a toggle cannot grow a third
state. Google Drive is not one of them: it is a mirror of cloud documents, not a
place a document is stored ([Google Drive is a mirror, not a location](#google-drive-is-a-mirror-not-a-location)).

So the toggle becomes a **Save location** chooser: a row of selectable tiles,
exactly one active, where each tile is one place a document can live. The
underlying stores are unchanged; this spec is about the choice and the contract
for adding to it.

## The chooser

The Settings step reads, top to bottom: **Document name**, **Save location**,
then the folder step, **Choose {location} Folder** (folder / team placement,
the shared `PlacementBrowser`).

**Save location** is a radio group of tiles (icon over label over caption,
the `PlacementCard` tile). The locations today:

| Tile              | Caption          | What it means                                                                                                |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **livediagram**   | Your account     | A normal cloud document, saved to the api (D1), reachable from any device.                                   |
| **Local Browser** | This device only | Offline Mode ([Offline Mode](offline-mode.md)): saved only in this browser's IndexedDB, never to the server. |

- **The default is pre-selected** on every open of the wizard, and depends on
  who is creating (below).
- Choosing **Local Browser** does what turning the old toggle on did: the
  data-loss warning (with its help link) appears beneath the row, and the
  folder step **disappears**, because an offline document has no server folder
  or team, so there is nothing to choose. (The old toggle left a greyed "My
  Work (Offline)" placeholder card; a step with one unchoosable option is
  noise.)
- Switching back to livediagram restores the folder step with whatever
  placement was selected before.
- Only **shipped** locations are shown. There are no greyed-out "coming soon"
  tiles for GitHub: a tile that cannot be chosen is a promise the
  product has not made yet.

### The default depends on who is creating

| Who                               | Default           |
| --------------------------------- | ----------------- |
| A guest, with sign-in enabled     | **Local Browser** |
| A signed-in person                | **livediagram**   |
| Anyone on a guest-only deployment | **livediagram**   |

Why a guest starts local: [Auth + guest access → Guest documents start local](../014-identity/auth-and-guest-access.md#guest-documents-start-local).

- One function answers it: `defaultSaveLocationFor({ signedIn, clerkEnabled })` in
  `apps/live/lib/save-locations.ts`. Every create path asks it, through
  `useNewDocumentLocation` (`apps/live/app/new/useNewDocumentLocation.ts`): the
  wizard's pre-selection (the picker's `defaultSaveLocation`), its Skip, and the
  wizard-less links (`/new?template=`, `/new?blank=1`).
- A `/new?folder=` / `?team=` context names a server place, so it is
  livediagram whoever is creating.
- Before Clerk has answered, `signedIn` is the `__client_uat` hint
  ([Who is a guest, before Clerk answers](../014-identity/auth-and-guest-access.md#who-is-a-guest-before-clerk-answers));
  once it settles, the settled answer. The wizard re-reads the default until
  the reader picks a tile, so a signed-in person never sees Local Browser stuck
  on from the moment before Clerk answered.
- In the wizard, a saved "Always save new documents in <place> and skip this step"
  ([Default folders](../013-workspace/default-folders.md)) beats the default: it
  is the reader's own choice. The wizard-less links never read it (as before).
- For a guest, choosing Local Browser shows the same data-loss warning as
  anyone gets; that it is the default does not soften it.

The tile glyphs: the livediagram tile carries the brand mark (the same
`BrandMark` the site header uses, exported from `@livediagram/ui` rather than
redrawn); Local Browser carries a browser-window glyph. The cloud-with-a-slash
glyph stays on the offline "My documents" placeholder card below, where it still
says what that card means.

## The folder step

The folder step is headed by the chosen location, **"Choose livediagram
Folder"**, so the two steps read as a sequence (where, then where within it)
rather than two versions of the same question. A future location that has
folders gets the same heading with its own name.

It renders the shared `PlacementBrowser` in its **`list` layout**: stacked
rows, icon beside label, the kind caption ("Top level", "Folder", "Open
folder") pinned right like a file explorer's Type column, with the inline New
Folder row last. Same browse, same placement strings, same double-click
commit; only the shape differs. The move-to-folder dialog ([Folders](../013-workspace/folders.md)) keeps the
`tiles` layout: there is no tile row above it to clash with, and the tiles
were drawn for that dialog. The layout is a prop on the browser, not a second
browser, so the product still has exactly one way to choose where a document
lives.

**Subfolder count.** A destination that holds more folders says so with a
small badge beside its name, "1 Subfolder" / "3 Subfolders": the space cards
on the overview (root folders of My documents or the team), the "save here" card
at the top of a level, and any folder row that drills in. A folder with
nothing inside shows no badge, so the badge itself is the "there's more in
here" cue, not just a number. Both layouts show it; in a row it sits beside
the name, on a tile it takes its own line between name and caption.

**The bar.** A full-width bar sits above the rows at **every** level. Where
there is a level above, it is the back button (chevron, the level's name,
and a chip naming where you are). Where there is not, it is a static heading
in the same shape: **"Choose a Space"** on the space overview, **"Choose a
Folder"** (with the space's name as the chip) at the root of a team-scoped
surface's one team. **The overview is always the first screen wherever
My documents is offered**, even when it is the only space: choosing where
a document lives starts with choosing the space, deliberately, and that
screen is where a "create a team" option belongs for someone who has no
team yet. An earlier version dropped a lone My documents space straight into
its folders, which left nowhere to put that option.

**It opens where its selection is.** The overview is the first screen while
the selection is a space's root. When the selection is a **folder** (a
`/new?folder=` context, the wizard's pre-selected default folder, the folder a
moved document lives in, a key's current default folder), the browser opens at
the level that lists that folder, its card checked, so the screen shows the
place the document will go; the bar's back button leads up to the space and
the overview. Until the reader moves about in the browser it follows the
selection, so a default that resolves after the step appears, or a new one
chosen through **Change default**, is opened to as well. Once the reader
selects, drills, goes back or creates in it, it stays where they take it. A
folder the browser cannot see yet (its list still loading) opens the
overview, and the level once the folder arrives.

That option is the **New Team tile**, last on the overview after the
team cards: the same dashed inline-name tile as New Folder (one
`InlineCreateTile`, two skins), reading "New Team · Create a New Team". Type a
name and the team is created (`POST /api/teams`, [Teams](../013-workspace/teams.md)), joins the
overview, and the browser enters it with its root selected, because the
point of making a team here is to file this document in it. **Signed-in
only**: teams are Clerk-only, so the hosts (the wizard, the Explorer's
move dialog) pass the create handler only when there is a Clerk user, and
a guest never sees a tile that would lead to a 401. Folder moves pass no
handler either, since a folder can't move into a team.
So the bar never appears and disappears under the rows as you move about,
which was its own jolt.

**Motion.** Drilling into a space or folder, or backing out, swaps the whole
level, and a level that lands in one frame is a jolt. So the bar eases in
when the browser mounts (fade, short slide, height from zero) and the rows
beneath it enter as a **cascade**, each a beat (10 ms) after the one above, the whole cascade settling within the 250ms budget of [Motion](../004-interface-design/motion.md): list rows slide in and
grow from zero height so the rows below ease down with them; tiles fade,
since a grid track already holds their place. The cascade runs on every level
change and on first appearance; a folder created in place only animates its
own row. Reduced motion ([User preferences](../007-editor/user-preferences.md)) collapses both the duration and the
per-row delay, so nothing waits on a beat it will never see.

**What it pre-selects.** A `/new?folder=` or `?team=` context is pre-selected. Without one, the
folder step pre-selects the reader's [default folder](../013-workspace/default-folders.md#the-new-document-wizard)
for the template picked on the first step, says why above the browser ("**Whiteboards** go to
**Workshops** by default", with **Change default**), and offers **Always save <these> here** beneath
it. A place the reader picks themselves, the My documents root tile included, is always the one
used.

## The contract for adding a location

A save location is one entry in a small catalogue, `apps/live/lib/save-locations.ts`:

- `SaveLocationId` is the closed union of location ids (`'livediagram' |
'browser'` today).
- `SAVE_LOCATIONS` is the ordered list the chooser renders (id, label,
  caption). Order is display order; the default is first.
- `DEFAULT_SAVE_LOCATION` is `'livediagram'`.
- `isOfflineLocation(id)` says whether an id resolves to the browser-only store.
  It is the only place the wizard's model touches [Offline Mode](offline-mode.md)'s notion of "offline".

Adding a location (say, GitHub) means: a new id in the union, a new
catalogue entry, a glyph in the picker's icon map (the map is typed on the id,
so a missing glyph is a compile error, not a blank tile), and a create branch in
`/new` that hands the document to that store. Nothing in the wizard's step,
footer, or state needs to change.

The wire between the wizard and `/new` is `NewDocumentSettings.saveLocation:
SaveLocationId`. It replaces the old `offline: boolean`; the boolean was the
toggle's shape leaking into the contract, and it is exactly what a third
location could not fit through.

## Google Drive is a mirror, not a location

A signed-in user can mirror the documents in My documents to their own Google
Drive. The document still lives in livediagram (the default location): Drive
holds a copy that is kept in sync both ways while a tab is open, and a Drive
file is never the document's home. So Drive never becomes a tile here, the
wizard does not change when the mirror ships, and a document created with
**livediagram** is mirrored like any other. Local Browser documents have no
server copy and are not mirrored. The mirror itself (connection, folder tree,
rename, move, delete to Trash, "Open with") is specified in [Google Drive mirror](../022-drive-mirror/drive-mirror.md), not
here.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Unchanged in shape: `Document` / `Created` carries a `type` naming the store,
`Cloud` for livediagram and `Offline` for Local Browser. A future location adds
its own preset `type`; the location id itself never leaves as content.

## Help centre ([Help app](../018-help/help-app.md))

The Offline Mode article's "creating" step names the chooser ("choose **Local
Browser** under **Save location**") instead of the old toggle. The Explorer's
empty Offline list says the same. No new article: the chooser is one row of the
wizard, and each location's article (offline today) is where the substance is.

## Non-goals

- Changing where a document is stored **after** creation. Conversion between
  livediagram and Local Browser stays with [Offline Mode](offline-mode.md)'s Sync Document / Take
  Offline; other locations will define their own when they ship.
- Any implementation of GitHub storage. This spec only makes room for it.

## Implementation map

- `apps/live/lib/save-locations.ts` (+ test): the catalogue and helpers above,
  plus `saveLocationLabel` for the folder-step heading.
- `apps/live/components/placement/PlacementBrowser.tsx`: the `layout` prop
  (`tiles` | `list`) on the browser, its `PlacementCard`, and `NewFolderTile`.
- `apps/live/components/palette/SaveLocationPicker.tsx`: the tile row, built on
  `PlacementCard`.
- `apps/live/components/palette/template-picker-settings.tsx`: the Settings
  step swaps the toggle for the chooser; the warning and the folder step's
  presence key on `isOfflineLocation`.
- `apps/live/components/palette/TemplatePicker.tsx`: `NewDocumentSettings.saveLocation`,
  threaded into every `onPick`.
- `apps/live/app/new/page.tsx`: derives the offline create branch from the
  location id.
- `packages/ui`: `BrandMark` exported for the livediagram tile.

## References

See [Dedicated route for new-document creation](../007-editor/new-document-route.md) (the wizard),
[Offline Mode](offline-mode.md) (the browser-only store),
[Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Help app](../018-help/help-app.md) (help).
