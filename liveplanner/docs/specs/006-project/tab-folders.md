# Tab folders

## Why

A plan's tabs are a flat, ordered list along the tab bar. Once a plan grows past a handful of tabs that list gets unwieldy. Users want to group related tabs into a named **folder**, e.g. put three tabs under "Organisation" and two under "Plans", that takes one chip of space on the bar when they're not using it.

This is the editor's tab bar only. It is unrelated to [Folders](../013-workspace/folders.md), which files **plans** in the Explorer.

## Scope

- **One level.** A folder contains tabs; folders never contain folders.
- **Beside the order, not in the body.** Tab order lives on the plan's `plan_tabs` row for the tab, not on the `tabs` body row ([Tab ↔ project many-to-many](tab-project-many-to-many.md)). Folder membership lives in the same place, so a content save never touches it, and a tab shared into two plans can sit in a folder in one and loose in the other. Folder membership is **never** part of the tab body (`tabs.data`).
- **Identified by name.** There is no folder entity or table. A folder _is_ a name string. It exists as long as at least one tab in the plan carries that name; it disappears when the last member leaves. Renaming a folder = rewriting the name on every member.

## Data model

The plan's `plan_tabs` table ([Tab ↔ project many-to-many](tab-project-many-to-many.md), `apps/api/src/plan-room/plan-schema.ts`) carries one nullable column:

```sql
folder TEXT,  -- NULL = loose (no folder)
```

No index (folders are derived by a client-side scan over the already-ordered read). The column is intentionally **not** mirrored onto the `tabs` table: folder membership is about where the tab sits, not what it holds.

## Ordering: one flat list, folders are contiguous runs

There is **one** order per plan (`plan_tabs.order_index`). A folder is a **maximal run of adjacent tabs that share a folder name**, drawn under one chip. There is no second ordering dimension and no per-folder order.

To keep that invariant true after any reorder or membership change, the client **normalizes** the order before persisting:

> Stable-sort the tabs by the key `(folderAnchorIndex, originalIndex)`, where `folderAnchorIndex` is the minimum original index among all tabs sharing that (non-empty) folder name. Loose tabs anchor on their own index.

This groups every folder's tabs at the position of the folder's first member, preserves each tab's order within its folder, and interleaves loose tabs by position. Normalization is idempotent and preserves tab object identity for tabs whose content did not change (so the autosave content diff doesn't spuriously re-save bodies). The single implementation lives in `packages/project/src/tab-folders.ts` (`normalizeFolderOrder`, `groupTabsIntoRuns`, `folderNamesInProject`) and is used by the tab-bar renderer and the editor's tab actions (`useTabActions`, `useTabFolders`) before they save. The server keeps the order it is sent; it only trims folder names.

A drag both reorders AND sets membership: the dropped tab **adopts the drop target's folder** (see "Membership UX" below), then normalization re-groups the runs. So dragging never "snaps back" — it moves the tab to wherever it was dropped, in or out of a folder.

## Membership UX

Folder membership changes two ways:

**1. Drag and drop.** Dropping a tab onto a folder's pills (or onto the folder chip, which targets the run's first member, so it works while the members are tucked away too) **joins** that folder; dropping it among loose tabs makes it **loose**; dropping it among a different folder's pills **moves** it there. The tab simply adopts the drop target's folder. `reorderTabs` performs the membership change in the same commit as the reorder.

**Drop position is deterministic + shown.** While dragging, the tab bar reads the pointer's position within the hovered pill: the left half means "land **before** this tab", the right half means "land **after**", and a vertical **insertion caret** renders in that exact gap so the user can see where the tab will go before releasing. `reorderTabs` takes a `placeBefore` flag (set from that side) and recomputes the target index _after_ removing the source, so the result matches the caret regardless of drag direction. (Dropping onto a folder chip omits the flag and joins at the run's head, as above.) Before this, the only cue was a highlight ring around the whole target and the landing side flipped with drag direction, so the drop was hard to predict.

**2. The tab's right-click / ellipsis menu** — an **Organise in Tab Folder** row that opens a centred **modal** (`AddTabToFolderDialog`, the same tile-grid language as the shared placement browser, [Folders](../013-workspace/folders.md)), replacing the old cramped in-menu sub-view. The row and the dialog title both read **Organise in Tab Folder** (once "Add to Folder", which did not say which folders it meant or that it also moves a tab between folders and out of one). Picking commits immediately and closes:

- **A tile per existing folder** in this plan → move the active tab into it (the current folder's tile reads "Current" and is a no-op).
- **A "No Folder" tile** → makes the tab loose on the bar; selected when the tab already is.
- **A "New Folder" tile** → create-in-place naming (the placement browser's dashed tile); typing an existing name just moves the tab into it (same name = same folder).

## Tab bar rendering

`TabBar` maps over `groupTabsIntoRuns(tabs)` instead of the flat list:

- **Loose** entries render the tab pill: a softly-rounded chip (rounded-lg — deliberately not a full pill) with **neutral slate text** so the name reads on the bar whatever the tab's theme, and the theme accent kept on the label's leading **opening-mode icon** (the glyph of the tab's mode, [Editor modes](../007-editor/editor-modes.md)). The **active** tab is a raised card — a bar-contrasting surface (white / slate-800) with an accent ring + shadow and accent-coloured text — so it can never blend into the bar; inactive tabs are soft tinted chips. The bar itself sits on a slate-50 surface so the active card pops.
- **Folder** entries render as a **container**, clearly distinct from the tab pills inside it: a **dashed** rounded boundary over a tinted inset surface, carrying a **folder glyph** (closed when the fan is tucked away, open while it shows — no separate chevron), the folder **name** (small caps, no tooltip), and the member count as a small rounded **badge**. Members **fan UPWARD**: clicking the chip opens a transient popover above the bar listing the members vertically — the same pills loose tabs use (selection, presence, drag-reorder, context menu) — instead of expanding sideways, so a big folder costs one chip of horizontal space. Only the folder's **active member** (when the active tab lives in the folder) renders inline beside the chip; picking a member from the fan switches to it (it becomes the inline pill) and closes the fan. The fan closes on outside press, Escape, or any tab switch; the old persisted per-folder collapse state is gone (the fan is transient), and the chip surfaces the **presence** of its hidden members (the inline pill shows its own stack).
- Clicking the chip toggles the fan. Double-clicking renames (rewrites every member). Nothing about the fan is stored or broadcast.

## Persistence & realtime

Folder rides the **same wire path as `orderIndex`**, never the per-tab content `PUT`:

- `PUT /api/projects/:id` body widens from `{ name?, tabIds? }` to also accept `{ tabs?: { id, folder? }[] }`. New clients send `tabs` (order = array position, plus folder); the server falls back to `tabIds` (folder null) for older clients. Empty/whitespace folder names are trimmed to NULL server-side. An entry that is neither a tab id nor `{ id, folder? }` with a text or null folder refuses the whole request (400 `invalid tabs`) before anything is written, the rename included.
- The `project-meta` room op's `tabs` entries widen to `{ id, name, orderIndex, folder? }` so a peer's folder change applies live. `folder` is optional throughout, so an older peer/client omitting it is treated as loose — no parse break.
- `reorderTabs` (`apps/api/src/db/tabs.ts`) writes `plan_tabs.folder` alongside `order_index`. The per-tab content save leaves `plan_tabs.folder` untouched, so a content save can never clobber membership.
- The persisted tab body strips `folder` (centralised with `templateChosen` in `stripUiTabFields`), so folder never leaks into `tabs.data`.

## Telemetry

Reuses the closed vocabulary ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)) with **the subject deciding the category**, and every event carries a `type` so none of it collides with tab lifecycle:

| What Happened                   | Event                |
| ------------------------------- | -------------------- |
| A tab was filed into a folder   | `Tab·Moved·Folder`   |
| A tab was taken out of a folder | `Tab·Removed·Folder` |
| A folder came into existence    | `Folder·Created·Tab` |
| A folder was renamed            | `Folder·Renamed·Tab` |

The folder **name is user content** and is never sent as the `type` argument — the `Tab` type on the `Folder` events distinguishes a tab folder from an explorer folder of projects, nothing more.

The `type` is not decoration. A dashboard metric card selects rows by an exact `type` match and `null` is a value, so the original untyped spelling of this table (`Tab·Created` for a new folder, `Tab·Renamed` for a folder rename) landed folder operations in the headline "Tabs Created" and "Tabs Renamed" cards, inflating a count of tabs with a count of folders.

Two further rules, both learned from the untyped version:

- **A new folder emits two events**, `Folder·Created·Tab` then `Tab·Moved·Folder`, because typing a name the plan hasn't used is genuinely two facts (the folder exists; this tab is in it). Emitting only the creation made "tabs filed into folders" undercount by exactly the number of folders anyone created. Listed with the other deliberate double-emits in [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md).
- **The menu and the drag report identically.** Membership can change either from the ellipsis menu or from a drag that adopts the drop target's folder, and the two had drifted: leaving a folder by menu counted as `Tab·Removed`, leaving it by drag counted as `Tab·Reordered`. Which control someone reached for is not the fact being measured, so both paths go through one module (`hooks/persistence/tab-folder-reporting.ts`). A drag that crosses a folder boundary reports the membership change and **not** the reorder it came with; `Tab·Reordered` now means a reorder that changed nothing else.

## Edge cases

- **Active tab in a folder** → it renders inline beside the chip, so the user can always see where they are.
- **One-tab folder** → valid; renders as a chip.
- **Empty/whitespace name** → treated as loose everywhere (client normalize, create handler rejects, server trims to NULL).
- **Name uniqueness within a plan** → same name is the same folder (members merge into one run on normalize).
- **Shared tab, foldered in A, loose in B** → naturally correct: folder is on each plan's `plan_tabs` row, never in the body that is kept in step.
- **Add to Plan** → the tab lands loose in the other plan; its folder there is the person's to choose.

## Cross-references

- [Per-tab storage](per-tab-storage.md) — per-tab storage; folder is link metadata, not body content.
- [Tab ↔ project many-to-many](tab-project-many-to-many.md) — the `plan_tabs` table the folder column sits on.
- [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) — telemetry enums reused here.
