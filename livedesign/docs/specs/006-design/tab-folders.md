# Tab folders

## Why

A design's tabs are a flat, ordered list along the tab bar. Once a design grows past a handful of tabs that list gets unwieldy. Users want to group related tabs into a named **folder**, e.g. put three tabs under "Organisation" and two under "Plans", that takes one chip of space on the bar when they're not using it.

This is the editor's tab bar only. It is unrelated to [Folders](../013-workspace/folders.md), which nests **designs** in the Explorer.

## Scope

- **One level.** A folder contains tabs; folders never contain folders.
- **Per-design.** Tab order lives on the `design_tabs` link, not on the `tabs` row, and folder membership lives in the same place. Folder membership is **never** part of the tab body (`tabs.data`).
- **Identified by name.** There is no folder entity or table. A folder _is_ a name string. It exists as long as at least one tab in the design carries that name; it disappears when the last member leaves. Renaming a folder = rewriting the name on every member.

## Data model

One nullable column on the design's link table, in its own SQLite (`apps/api/src/design-room/design-schema.ts`):

```sql
design_tabs.folder TEXT  -- NULL = loose (no folder)
```

No index (folders are derived by a client-side scan over the already-ordered read). The column lives on the design's link to the tab (`design_tabs.folder`, in the design's own SQLite), beside its order.

## Ordering: one flat list, folders are contiguous runs

There is **one** per-design order (the existing `design_tabs.order_index`). A folder is a **maximal run of adjacent tabs that share a folder name**, drawn under one chip. There is no second ordering dimension and no per-folder order.

To keep that invariant true after any reorder or membership change, the client **normalizes** the order before persisting:

> Stable-sort the tabs by the key `(folderAnchorIndex, originalIndex)`, where `folderAnchorIndex` is the minimum original index among all tabs sharing that (non-empty) folder name. Loose tabs anchor on their own index.

This groups every folder's tabs at the position of the folder's first member, preserves each tab's order within its folder, and interleaves loose tabs by position. Normalization is idempotent and preserves tab object identity for tabs whose content did not change (so the autosave content diff doesn't spuriously re-save bodies). The single implementation lives in `packages/design/src/tab-folders.ts` (`normalizeFolderOrder`, `groupTabsIntoRuns`, `folderNamesInDesign`) and is consumed by the tab-bar renderer, the client save path, and the server route (defensive).

A drag both reorders AND sets membership: the dropped tab **adopts the drop target's folder** (see "Membership UX" below), then normalization re-groups the runs. So dragging never "snaps back": it moves the tab to wherever it was dropped, in or out of a folder.

## Membership UX

Folder membership changes two ways:

**1. Drag and drop.** Dropping a tab onto a folder's tabs (or onto the folder chip, which targets the run's first member, so it works while the members are tucked away too) **joins** that folder; dropping it among loose tabs makes it **loose**; dropping it among a different folder's tabs **moves** it there. The tab simply adopts the drop target's folder. `reorderTabs` performs the membership change in the same commit as the reorder.

**Drop position is deterministic + shown.** While dragging, the tab bar reads the pointer's position within the hovered tab: the left half means "land **before** this tab", the right half means "land **after**", and a vertical **insertion caret** renders in that exact gap so the user can see where the tab will go before releasing. `reorderTabs` takes a `placeBefore` flag (set from that side) and recomputes the target index _after_ removing the source, so the result matches the caret regardless of drag direction. (Dropping onto a folder chip omits the flag and joins at the run's head, as above.) Before this, the only cue was a highlight ring around the whole target and the landing side flipped with drag direction, so the drop was hard to predict.

**2. The tab's right-click / ellipsis menu**: an **Organise in Tab Folder** row that opens a centred **modal** (`AddTabToFolderDialog`, the same tile-grid language as the shared placement browser, [Folders](../013-workspace/folders.md)). The row and the dialog title both read **Organise in Tab Folder**, which says which folders it means and that it also moves a tab between folders and out of one. Picking commits immediately and closes:

- **A tile per existing folder** in this design → move the active tab into it (the current folder's tile reads "Current" and is a no-op).
- **A "No Folder" tile** → makes the tab loose on the bar; selected when the tab already is.
- **A "New Folder" tile** → create-in-place naming (the placement browser's dashed tile); typing an existing name just moves the tab into it (same name = same folder).

## Tab bar rendering

`TabBar` maps over `groupTabsIntoRuns(tabs)` and hands the runs to the shared strip (`packages/workbench/src/components/chrome/TabStrip.tsx`, with `TabFrame` and `TabFolderGroup` beside it), so all four editors draw tabs and folders alike:

- **Loose** entries render a tab, as [How a tab looks](../007-editor/live-app.md#how-a-tab-looks) describes.
- **A folder opens in place, in the strip.** Its **chip** comes first: the folder's name on a soft tint of the folder's colour, a chevron that points the way the folder will move (right while it is closed, left while it is open) and, while closed, the member count in a small badge of the folder's colour. Clicking the chip, or Enter or Space on it, **expands the folder's tabs inline, right after the chip**; clicking again collapses them. Their width eases open or shut over 180 ms, the badge easing out or back with them, and the neighbours slide along (at once under reduced motion). There is no popover and no list: the folder never leaves the strip.
- **The folder's tabs read as one group.** The chip and its tabs stand on a **shelf**, a faint tint of the folder's colour rounded on top and standing on the bottom edge like the tabs. The open tab keeps its own card on the shelf.
- **The folder's colour comes from its name**, a stable pick from eight hues (blue, violet, emerald, amber, rose, cyan, orange, pink), so a folder keeps its colour from visit to visit and every collaborator sees the same one. Nothing is stored for it; renaming a folder may give it another hue.
- **The open tab is always in view.** When it is in a collapsed folder it stays in the strip, on the folder's shelf right after the chip, so the folder plainly holds where you are; the other members stay tucked away and the badge still counts them all.
- **Open or closed belongs to this visit.** Folders start collapsed; nothing about expanding one is stored or broadcast, and switching tabs never closes one. Renaming a folder keeps it open or closed as it was.
- **Expanding brings the group into view.** When the expanded tabs run past the strip's edge, the strip scrolls the least distance that shows the whole folder (or as much of it as fits, from the chip), clear of the edge fade, so on a phone the folder's tabs come on screen.
- **Presence.** A collapsed folder's chip carries the presence stack of the people on its tucked-away members (the open tab shows its own).
- **Dragging.** Holding a dragged tab over a collapsed chip for half a second springs the folder open, so the tab can land between its members; dropping it on the chip joins the folder at its head, open or not. The dragged tab dims while it moves and a 2 px caret marks where it will land.
- **Keyboard and screen readers.** The strip is a `tablist`. Each tab's name is a `tab`, `aria-selected` on the open one; each chip is a `tab` too, with `aria-expanded` and the name "Planning, 3 tabs", that toggles rather than opens. Tab moves focus into the strip on the open tab; Left and Right move between tabs and chips (skipping tucked-away members, which are `inert`), Home and End go to the first and last; Enter or Space opens a tab or toggles a folder.
- Double-clicking the chip renames the folder (rewrites every member).

## Persistence & realtime

Folder rides the **same wire path as `orderIndex`**, never the per-tab content `PUT`:

- `PUT /api/designs/:id` body widens from `{ name?, tabIds? }` to also accept `{ tabs?: { id, folder? }[] }`. New clients send `tabs` (order = array position, plus folder); the server falls back to `tabIds` (folder null) for older clients. Empty/whitespace folder names are trimmed to NULL server-side. An entry that is neither a tab id nor `{ id, folder? }` with a text or null folder refuses the whole request (400 `invalid tabs`) before anything is written, the rename included.
- The `design-meta` room op's `tabs` entries widen to `{ id, name, orderIndex, folder? }` so a peer's folder change applies live. `folder` is optional throughout, so an older peer/client omitting it is treated as loose, with no parse break.
- `reorderTabs` writes `design_tabs.folder` alongside `order_index`. The per-tab content upsert (`upsertTab`) leaves `design_tabs.folder` untouched, so a content save can never clobber membership.
- The persisted tab body strips `folder` (centralised with `templateChosen` in `stripUiTabFields`), so folder never leaks into the shared `tabs.data`.

## Telemetry

Reuses the closed vocabulary ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)) with **the subject deciding the category**, and every event carries a `type` so none of it collides with tab lifecycle:

| What Happened                   | Event                |
| ------------------------------- | -------------------- |
| A tab was filed into a folder   | `Tab·Moved·Folder`   |
| A tab was taken out of a folder | `Tab·Removed·Folder` |
| A folder came into existence    | `Folder·Created·Tab` |
| A folder was renamed            | `Folder·Renamed·Tab` |

The folder **name is user content** and is never sent as the `type` argument; the `Tab` type on the `Folder` events distinguishes a tab folder from an explorer folder of designs, nothing more.

The `type` is not decoration. A dashboard metric card selects rows by an exact `type` match and `null` is a value, so the original untyped spelling of this table (`Tab·Created` for a new folder, `Tab·Renamed` for a folder rename) landed folder operations in the headline "Tabs Created" and "Tabs Renamed" cards, inflating a count of tabs with a count of folders.

Two further rules, both learned from the untyped version:

- **A new folder emits two events**, `Folder·Created·Tab` then `Tab·Moved·Folder`, because typing a name the design hasn't used is genuinely two facts (the folder exists; this tab is in it). Emitting only the creation made "tabs filed into folders" undercount by exactly the number of folders anyone created. Listed with the other deliberate double-emits in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md).
- **The menu and the drag report identically.** Membership can change either from the ellipsis menu or from a drag that adopts the drop target's folder, and the two had drifted: leaving a folder by menu counted as `Tab·Removed`, leaving it by drag counted as `Tab·Reordered`. Which control someone reached for is not the fact being measured, so both paths go through one module (`hooks/persistence/tab-folder-reporting.ts`). A drag that crosses a folder boundary reports the membership change and **not** the reorder it came with; `Tab·Reordered` now means a reorder that changed nothing else.

## Edge cases

- **Active tab in a folder** → it stays in the strip on the folder's shelf beside the chip, even while the folder is collapsed, so the user can always see where they are.
- **One-tab folder** → valid; renders as a chip with its one tab tucked away until expanded.
- **Empty/whitespace name** → treated as loose everywhere (client normalize, create handler rejects, server trims to NULL).
- **Name uniqueness within a design** → same name is the same folder (members merge into one run on normalize).
- **Shared tab, foldered in A, loose in B** → naturally correct: folder is on the link, never in the body.

## Cross-references

- [Per-tab storage](per-tab-storage.md): per-tab storage; folder is link metadata, not body content.
- [Tab ↔ design many-to-many](tab-design-many-to-many.md): the `design_tabs` link table folder now extends.
- [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): telemetry enums reused here.
