# 141 — Save Locations

The New Diagram wizard's Settings step (spec/14, spec/76) asks **where a new
diagram is stored**. Until now that question was a single iOS-style toggle,
"Save Offline, This Browser Only", which could only ever answer yes or no: on
the server, or in this browser. More stores are coming (Google Drive is the
first candidate; GitHub is plausible), and a toggle cannot grow a third state.

So the toggle becomes a **Save location** chooser: a row of selectable tiles,
exactly one active, where each tile is one place a diagram can live. The
underlying stores are unchanged; this spec is about the choice and the contract
for adding to it.

## The chooser

The Settings step reads, top to bottom: **Diagram name**, **Save location**,
then the folder step, **Choose {location} Folder** (folder / team placement,
the shared `PlacementBrowser`).

**Save location** is a radio group of tiles (icon over label over caption,
the `PlacementCard` tile). The locations today:

| Tile              | Caption          | What it means                                                                          |
| ----------------- | ---------------- | -------------------------------------------------------------------------------------- |
| **livediagram**   | Your account     | The default. A normal cloud diagram, saved to the api (D1), reachable from any device. |
| **Local Browser** | This device only | Offline Mode (spec/76): saved only in this browser's IndexedDB, never to the server.   |

- **livediagram is the default** and pre-selected on every open of the wizard.
  Nothing about the default behaviour of creating a diagram changes.
- Choosing **Local Browser** does what turning the old toggle on did: the
  data-loss warning (with its help link) appears beneath the row, and the
  folder step **disappears**, because an offline diagram has no server folder
  or team, so there is nothing to choose. (The old toggle left a greyed "My
  Work (Offline)" placeholder card; a step with one unchoosable option is
  noise.)
- Switching back to livediagram restores the folder step with whatever
  placement was selected before.
- Only **shipped** locations are shown. There are no greyed-out "coming soon"
  tiles for Drive or GitHub: a tile that cannot be chosen is a promise the
  product has not made yet.

The tile glyphs: the livediagram tile carries the brand mark (the same
`BrandMark` the site header uses, exported from `@livediagram/ui` rather than
redrawn); Local Browser carries a browser-window glyph. The cloud-with-a-slash
glyph stays on the offline "My Work" placeholder card below, where it still
says what that card means.

## The folder step

The folder step is headed by the chosen location, **"Choose livediagram
Folder"**, so the two steps read as a sequence (where, then where within it)
rather than two versions of the same question. A future location that has
folders gets the same heading with its own name.

It renders the shared `PlacementBrowser` in its **`list` layout**: stacked
rows, icon beside label, the kind caption ("Unsorted", "Folder", "Open
folder") pinned right like a file explorer's Type column, with the inline New
Folder row last. Same browse, same placement strings, same double-click
commit; only the shape differs. The move-to-folder dialog (spec/15) keeps the
`tiles` layout: there is no tile row above it to clash with, and the tiles
were drawn for that dialog. The layout is a prop on the browser, not a second
browser, so the product still has exactly one way to choose where a diagram
lives.

**Subfolder count.** A destination that holds more folders says so with a
small badge beside its name, "1 Subfolder" / "3 Subfolders": the space cards
on the overview (root folders of My Work or the team), the "save here" card
at the top of a level, and any folder row that drills in. A folder with
nothing inside shows no badge, so the badge itself is the "there's more in
here" cue, not just a number. Both layouts show it; in a row it sits beside
the name, on a tile it takes its own line between name and caption.

**Motion.** Drilling into a space or folder, or backing out, swaps the whole
level, and a level that lands in one frame is a jolt. So the back bar eases
in (fade, short slide, height from zero) and the rows beneath it enter as a
**cascade**, each a beat (40 ms) after the one above: list rows slide in and
grow from zero height so the rows below ease down with them; tiles fade,
since a grid track already holds their place. The cascade runs on every level
change and on first appearance; a folder created in place only animates its
own row. Reduced motion (spec/20) collapses both the duration and the
per-row delay, so nothing waits on a beat it will never see.

## The contract for adding a location

A save location is one entry in a small catalogue, `apps/live/lib/save-locations.ts`:

- `SaveLocationId` is the closed union of location ids (`'livediagram' |
'browser'` today).
- `SAVE_LOCATIONS` is the ordered list the chooser renders (id, label,
  caption). Order is display order; the default is first.
- `DEFAULT_SAVE_LOCATION` is `'livediagram'`.
- `isOfflineLocation(id)` says whether an id resolves to the browser-only store.
  It is the only place the wizard's model touches spec/76's notion of "offline".

Adding a location (say, Google Drive) means: a new id in the union, a new
catalogue entry, a glyph in the picker's icon map (the map is typed on the id,
so a missing glyph is a compile error, not a blank tile), and a create branch in
`/new` that hands the diagram to that store. Nothing in the wizard's step,
footer, or state needs to change.

The wire between the wizard and `/new` is `NewDiagramSettings.saveLocation:
SaveLocationId`. It replaces the old `offline: boolean`; the boolean was the
toggle's shape leaking into the contract, and it is exactly what a third
location could not fit through.

## Telemetry (spec/22)

Unchanged in shape: `Diagram` / `Created` carries a `type` naming the store,
`Cloud` for livediagram and `Offline` for Local Browser. A future location adds
its own preset `type`; the location id itself never leaves as content.

## Help centre (spec/55)

The Offline Mode article's "creating" step names the chooser ("choose **Local
Browser** under **Save location**") instead of the old toggle. The Explorer's
empty Offline list says the same. No new article: the chooser is one row of the
wizard, and each location's article (offline today) is where the substance is.

## Non-goals

- Changing where a diagram is stored **after** creation. Conversion between
  livediagram and Local Browser stays with spec/76's Sync Diagram / Take
  Offline; other locations will define their own when they ship.
- Any implementation of Google Drive or GitHub storage. This spec only makes
  room for them.

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
- `apps/live/components/palette/TemplatePicker.tsx`: `NewDiagramSettings.saveLocation`,
  threaded into every `onPick`.
- `apps/live/app/new/page.tsx`: derives the offline create branch from the
  location id.
- `packages/ui`: `BrandMark` exported for the livediagram tile.

## References

See [spec/14](14-new-diagram-route.md) (the wizard),
[spec/76](76-offline-mode.md) (the browser-only store),
[spec/22](22-telemetry.md) (events),
[spec/55](55-help-app.md) (help).
