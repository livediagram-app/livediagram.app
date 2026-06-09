# Tab folders

## Why

A diagram's tabs are a flat, ordered list along the tab bar. Once a diagram grows past a handful of tabs that list gets unwieldy. Users want to group related tabs into a named, collapsible **folder**, e.g. put three tabs under "Organisation" and two under "Plans", and collapse a folder down to its name when they're not using it.

This is the editor's tab bar only. It is unrelated to [spec/15](15-folders.md), which nests **diagrams** in the Explorer.

## Scope

- **One level.** A folder contains tabs; folders never contain folders.
- **Per-diagram.** Tab order already lives on the `diagram_tabs` link, not on the shared `tabs` row, because a tab can be shared into several diagrams ([spec/17](17-tab-diagram-many-to-many.md)). Folder membership lives in the same place, for the same reason: a tab shared into two diagrams can sit in a folder in one and be loose in the other. Folder membership is **never** part of the tab body (`tabs.data`).
- **Identified by name.** There is no folder entity or table. A folder _is_ a name string. It exists as long as at least one tab in the diagram carries that name; it disappears when the last member leaves. Renaming a folder = rewriting the name on every member.

## Data model

Migration `0018` adds one nullable column to the link table from [spec/17](17-tab-diagram-many-to-many.md):

```sql
ALTER TABLE diagram_tabs ADD COLUMN folder TEXT;  -- NULL = loose (no folder)
```

No backfill (every existing tab is loose), no index (folders are derived by a client-side scan over the already-ordered read). The column is intentionally **not** mirrored onto the legacy `tabs` table the way `order_index` is (migration 0011) — folder membership is a diagram-link concept with no legacy equivalent.

## Ordering: one flat list, folders are contiguous runs

There is **one** per-diagram order (the existing `diagram_tabs.order_index`). A folder is a **maximal run of adjacent tabs that share a folder name**, drawn under one chip. There is no second ordering dimension and no per-folder order.

To keep that invariant true after any reorder or membership change, the client **normalizes** the order before persisting:

> Stable-sort the tabs by the key `(folderAnchorIndex, originalIndex)`, where `folderAnchorIndex` is the minimum original index among all tabs sharing that (non-empty) folder name. Loose tabs anchor on their own index.

This groups every folder's tabs at the position of the folder's first member, preserves each tab's order within its folder, and interleaves loose tabs by position. Normalization is idempotent and preserves tab object identity for tabs whose content did not change (so the autosave content diff doesn't spuriously re-save bodies). The single implementation lives in `packages/diagram/src/tab-folders.ts` (`normalizeFolderOrder`, `groupTabsIntoRuns`, `folderNamesInDiagram`) and is consumed by the tab-bar renderer, the client save path, and the server route (defensive).

A drag both reorders AND sets membership: the dropped tab **adopts the drop target's folder** (see "Membership UX" below), then normalization re-groups the runs. So dragging never "snaps back" — it moves the tab to wherever it was dropped, in or out of a folder.

## Membership UX

Folder membership changes two ways:

**1. Drag and drop.** Dropping a tab onto a folder's pills (or onto the folder chip, which targets the run's first member, so it works on a collapsed folder too) **joins** that folder; dropping it among loose tabs makes it **loose**; dropping it among a different folder's pills **moves** it there. The tab simply adopts the drop target's folder. `reorderTabs` performs the membership change in the same commit as the reorder.

**2. The tab's right-click / ellipsis menu** — a third "Organise in folder" view alongside the existing actions / copy-to views, for precise / keyboard-free control:

- **An existing folder name** in this diagram → move the active tab into it.
- **New folder…** → inline text input; validates a trimmed, non-empty name that doesn't collide with an existing folder in this diagram (same name = same folder).
- **Remove from folder** → shown only when the active tab is in a folder; makes it loose.

## Tab bar rendering

`TabBar` maps over `groupTabsIntoRuns(tabs)` instead of the flat list:

- **Loose** entries render the existing tab pill.
- **Folder** entries render a chip carrying a **folder glyph** (drawn closed when collapsed, open when expanded — no separate chevron, the folder icon itself signals the state), the folder **name**, and the member count as a small rounded **badge**. **Collapsed** = just that chip; **expanded** = the chip plus the inline member pills, which behave exactly like loose pills (selection, presence, drag-reorder, context menu).
- Clicking the chip toggles collapse. Double-clicking renames (rewrites every member). Collapse/expand state is **UI-only**: per browser via `localStorage` key `tabfolder:<diagramId>:<folderName>`, never persisted to D1 and never broadcast.
- If the active tab is inside a collapsed folder, the chip force-expands so the user can always see where they are. Conversely, navigating the active tab **out** of an expanded folder **auto-collapses** it, so a folder only stays open while you're working inside it; re-entering force-expands it again.

## Persistence & realtime

Folder rides the **same wire path as `orderIndex`**, never the per-tab content `PUT`:

- `PUT /api/diagrams/:id` body widens from `{ name?, tabIds? }` to also accept `{ tabs?: { id, folder? }[] }`. New clients send `tabs` (order = array position, plus folder); the server falls back to `tabIds` (folder null) for older clients. Empty/whitespace folder names are trimmed to NULL server-side.
- The `diagram-meta` room op's `tabs` entries widen to `{ id, name, orderIndex, folder? }` so a peer's folder change applies live. `folder` is optional throughout, so an older peer/client omitting it is treated as loose — no parse break.
- `reorderTabs` writes `diagram_tabs.folder` alongside `order_index`. The per-tab content upsert (`upsertTab`) leaves `diagram_tabs.folder` untouched, so a content save can never clobber membership.
- The persisted tab body strips `folder` (centralised with `templateChosen` in `stripUiTabFields`), so folder never leaks into the shared `tabs.data`.

## Telemetry

Reuses the closed `Tab` category and existing actions ([spec/22](22-telemetry.md)): `track('Tab', 'Moved')` (into a folder), `'Removed'` (out), `'Created'` (new folder), `'Renamed'` (folder rename). The folder **name is user content** and is never sent as the `type` argument.

## Edge cases

- **Active tab in a collapsed folder** → chip force-expands.
- **One-tab folder** → valid; renders as a chip.
- **Empty/whitespace name** → treated as loose everywhere (client normalize, create handler rejects, server trims to NULL).
- **Name uniqueness within a diagram** → same name is the same folder (members merge into one run on normalize).
- **Shared tab, foldered in A, loose in B** → naturally correct: folder is on the link, never in the body.

## Cross-references

- [spec/13](13-per-tab-storage.md) — per-tab storage; folder is link metadata, not body content.
- [spec/17](17-tab-diagram-many-to-many.md) — the `diagram_tabs` link table folder now extends.
- [spec/22](22-telemetry.md) — telemetry enums reused here.
