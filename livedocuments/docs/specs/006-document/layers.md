# Layers

Photoshop-style layers per tab: named stacking bands that elements belong to. Layers give a tab structure (a template's scaffold under its content), let a stored tab keep whole slices hidden or frozen, and make z-order deliberate instead of an accident of insertion order.

livedocuments has **no Layers panel** (removed 8 November 2026, "Retired: the Layers panel" below): every tab is Pages ([Pages mode](../007-editor/pages-mode.md) "No Layers"), where a page is arranged by its pages, so nothing in the editor manages layers. A tab's stored layers keep working exactly as before: their order, visibility, lock and opacity shape the canvas, the exports and the snapshots.

## Active layer: the fallback must be usable

An explicit choice of active layer is honoured even when that layer is hidden or locked: hiding the layer you are ON is deliberate, and the editor toasts why creation is paused rather than moving you somewhere you did not ask to be. The FALLBACK (no stored preference) is different: it skips hidden and locked layers and lands on the topmost usable one. Taking the top layer blindly stranded any canvas whose top layer was hidden: every create path silently no-opped, and no toast could explain it, because the user had done nothing for a toast to describe.

## Data model (`@livedocuments/document`)

- `Layer = { id: string; name: string; visible?: boolean; locked?: boolean; opacity?: number }`. `visible` defaults to `true`, `locked` to `false`, `opacity` to `1` (absent = default, so untouched layers stay byte-light in the JSON blob). **Layer opacity** multiplies over each member element's own opacity in every renderer: canvas, image exports, server snapshots.
- `Tab.layers?: Layer[]`: ordered **bottom → top** (index 0 renders lowest).
- Every element gets an optional `layerId?: string`.
- **Legacy / default:** a tab with no `layers` array behaves as one implicit layer named **"Layer 1"**. The array is materialised lazily on the first layer operation, with the base layer created under a **fixed sentinel id** (`layer:default`) so concurrent clients materialising independently converge. An element with a missing or unknown `layerId` belongs to the default layer (falling back to the bottom layer if the default was deleted).
- Tab bodies are opaque JSON through the api worker and the document's store ([Per-tab storage](per-tab-storage.md)), so this needs **no migration, no api-schema change, no worker change**: layers round-trip and sync through the existing tab save + realtime paths. Because the body is opaque, a tab's `layers` is **settled on the way in** (`settleTabFields`, run by the stored-tab migration and on every peer's `tab-meta` patch): a layer without a non-empty string id, or a repeat of an id, is dropped; a missing name reads as "Layer N"; `visible`, `locked` and `opacity` keep only values of their types (opacity clamped to 0..1); a `layers` that is not an array, or keeps no layer, is dropped. The tab's `backgroundColor` and `patternColor` are kept only as strings. A malformed tab is repaired, never refused, so one bad write cannot leave a document that no one can open. The active layer is **per-user UI state**, never persisted or synced.

## Stacking (z-order)

- Render order is **layer bands**: all of layer 0, then all of layer 1, … Within a band, the existing `Tab.elements[]` array order still decides stacking, and stacks still paint first **within their band** (a stack on an upper layer sits above everything below that layer).
- The banding is a **stable partition applied at render/export time** (`layerBands`); `Tab.elements[]` itself is never re-sorted. New elements are appended to the array, so they land **on top of their layer**.
- **Bring to Front / Send to Back are layer moves**: they power the layers, not a per-element z-index. Bring to Front moves the selection onto the **top layer** (and to the top of that band); if the top layer holds anything outside the selection, a **new top layer is created** (same "Layer N" naming) and the selection moves there. Send to Back mirrors onto / below the bottom layer. Already frontmost / backmost = no-op. This is how layers accrue. The **selection popover** additionally carries an intra-band z-nudge: **Bring to Front** / **Send to Back** stack the selection within its OWN layer (array order inside the band, `bringManyToFront` / `sendManyToBack`, never a layer change), for the common case of two things overlapping on one layer. The element menu keeps the layer moves; the popover owns the nudge.
- **Pruning:** when one of these two buttons empties a layer (it moved the layer's last element away), that emptied layer is deleted automatically, so casual front/back clicking never litters the tab with abandoned empty layers. Only these two ops prune, and only the layer the moved elements just left. If the pruned layer was active, the active layer falls back to the top.

## Layer operations

All layer mutations are ordinary tab-body commits: they flow through the normal history (undoable), autosave, and realtime sync. With no panel, two reach the layers from the editor:

- **Bring to Front / Send to Back** (above, "Stacking").
- **Smart naming**: a layer still carrying its default "Layer N" name adopts a committed label from its elements. Fires when a label edit COMMITS (blur / Enter), alongside the document + tab auto-renames in commitLabel, never on mid-typing keystrokes (the type-to-edit path commits the first character immediately, which must not name the layer "C"; for the same reason there is deliberately NO "element was previously unlabelled" guard, since that first-keystroke commit would always trip it). Adoption needs the edited element to be the layer's ONLY labelled element, creation-seeded labels (tech icons, templates, paste, AI) never reach commitLabel, and once named (default pattern broken) adoption stops for good.

The document package (`@livedocuments/document`, `layer-operations.ts`) keeps the rest of the model's operations (add, rename, delete, reorder, merge, visibility, lock, opacity, clear, hide others, move elements to a layer) for the data model and its tests; the editor fires none of them.

## Active layer + element membership

- **Exactly one layer is always active** per tab: the topmost usable layer ("Active layer: the fallback must be usable" above). With no panel there is no way to choose another, so it is never stored. Session-scoped, per-device.
- **Every new element lands on the active layer**, whatever created it: palette draw/drop, double-click text, quick-connect arrows, paste, AI insert, template fill, Markdown import. Implemented once at the commit boundary: elements newly appearing in a commit without a valid `layerId` are stamped with the active layer (only once `layers` is materialised), so individual creation paths don't each carry layer logic. Duplicated / copied elements keep their source layer when it still exists on the target tab.
- While the active layer is **hidden or locked**, element creation is blocked (same guard as a locked tab, scoped to the layer): you never add an element you can't immediately see or touch. Paste is a creation path like any other: copied elements, a pasted image or photo, and a pasted or dropped board scene are all refused while the active layer is hidden or locked.
- **Blocked-creation notice**: the creation gates stay silent by design, so the moment the ACTIVE layer becomes un-addable (hidden or locked, by a peer or a stored tab) a toast says adding is paused and why. A refused paste repeats that toast every time: a paste is a deliberate keystroke with nothing else on screen to show it was ignored.
- **No Move to Layer**: the element menus' Layer section holds Bring to Front and Send to Back only (the "Move to layer" tiles went with the panel).

## Retired: the Layers panel

Removed 8 November 2026. In Pages, the one editor mode, the panel and its cluster button were never offered (CanvasChrome's gate on Pages), so its Settings (**Settings › Panels › Layers**: Enable Layers Panel, Layer Thumbnails, Layer Element Counts, Preview Layer on Hover) had nothing to act on, while the switch still offered the element menus' **Move to layer** tiles and the image export's **Hidden layers** row for layers no one could see or manage. All of it went:

- The panel (its rows, row menu, drag-to-reorder, hover-to-solo, header and footer) and its cluster button. The bottom-right cluster keeps the Theme & Canvas brush.
- The four Settings rows. livedocuments stops reading `layersPanelEnabled`, `layersShowPreview`, `layersShowCount` and `layerHoverPreview` ([User preferences](../007-editor/user-preferences.md) "Keys this editor does not read"); they stay common settings, as livediagram still has them.
- **Move to layer** in the single-element and multi-selection menus.
- The image export's **Hidden layers** option: hidden layers stay out of every export, as they stay off the canvas.
- The help articles about the panel ([help](../../../apps/help/app/canvas/layers/page.mdx)'s Layers article now says what layers still do).

The data stays: a stored tab's layers render, export and lock exactly as before.

## Layered templates

Templates whose scaffold stays put while their content moves ship with **pre-assigned layers** ([Canvas and palette](../008-canvas/canvas-and-palette.md)'s catalogue), so a fresh canvas lands with the split a careful user would build by hand: a scaffold band you can lock or hide in one click, and a content band that marquee / select-all sweeps without grabbing the frame behind it.

- The split lives entirely in `@livedocuments/templates`: a layered template's builder stamps `layerId` on every element it returns, and `templateCanvasOverrides(kind)` carries the matching `Tab.layers` array (bottom → top, from `templateLayers(kind)` in `template-layers.ts`). All three application paths (the editor picker, `/new`, the MCP worker) already spread that override object onto the tab in the same commit as the elements, so no caller carries layer logic; and because the layers land in the same commit, the commit-boundary stamp (above) sees the template's ids as known and leaves them alone.
- Every layered template shares the same TWO **fixed sentinel ids** (`layer:template:scaffold` under `layer:template:content`, the `layer:default` pattern), not random uuids: re-applying a template converges, and elements copied between any two layered-template tabs keep their band, even across template kinds. Only the display names vary per template.
- The **content layer sits on top**, so it's the default active layer (top-layer rule above) and everything the user adds lands with the content, never under the scaffold. The scaffold ships **named but unlocked**: shipping it locked would baffle anyone who just wants to resize a frame.
- Templates without a meaningful scaffold / content split (pages laid out from layouts, lockups, articles) stay layerless and keep the implicit single layer.
- Layered templates and their scaffold / content names (`templateLayers` in `packages/templates/src/template-layers.ts`): **Slide deck** and **Storyboard** Frames / Content · **Floor plan** Rooms / Furniture.

## Exports and snapshots

- **Image / PDF / SVG export** ([Canvas and palette](../008-canvas/canvas-and-palette.md)'s export dialog) skips hidden layers: render loops _and_ content bounds. There is no option to include them (what you see is what you export).
- **Exports stack like the canvas.** Every export (SVG, PNG / PDF, snapshots, thumbnails, the MCP preview) paints each band in the same order the canvas does: stacks first, then everything else in array order, **arrows interleaved with boxes**. So an arrow sent behind a box on the canvas stays behind it in an export.
- **Markdown export** skips hidden layers, as every other export does: its elements and its connections, an arrow pinned to a hidden element included.
- Server-rendered SVG snapshots ([Document previews](document-snapshots.md) thumbnails / [Live image share link](../013-workspace/live-image-share.md) live image) skip hidden layers too, via the shared renderer.

## Telemetry

Layer events are tracked per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md); types are preset enum values, never layer names. Only smart naming (`Layer`·`Renamed`·`Adopted`) is still sent. The panel's events (Added, Deleted, Cleared, Renamed `Manual`, Reordered, Changed `Opacity`, Selected, Moved, Removed, Toggled, Opened `Panel`), its Settings switches and the export's `HiddenLayersExport` are retired on the dashboard.

## Out of scope (for now)

- Per-layer opacity, blend modes, layer groups/nesting.
- Persisting or syncing the _active_ layer choice.
- Per-layer permissions.
