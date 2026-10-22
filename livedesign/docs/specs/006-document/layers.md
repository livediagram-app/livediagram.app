# Layers

Photoshop-style layers per tab: named stacking bands that elements belong to, managed from a Layers panel that opens as a popover over its bottom-right cluster button. Layers give big canvases structure (background / content / annotations), let you hide or freeze whole slices of a tab, and make z-order deliberate instead of an accident of insertion order.

## Active layer: the fallback must be usable

An explicit choice of active layer is honoured even when that layer is hidden or locked — hiding the layer you are ON is deliberate, and the editor toasts why creation is paused rather than moving you somewhere you did not ask to be. The FALLBACK (no stored preference) is different: it skips hidden and locked layers and lands on the topmost usable one. Taking the top layer blindly stranded any canvas whose top layer was hidden — every create path silently no-opped, and no toast could explain it, because the user had done nothing for a toast to describe.

## Data model (`@livedesign/document`)

- `Layer = { id: string; name: string; visible?: boolean; locked?: boolean; opacity?: number }`. `visible` defaults to `true`, `locked` to `false`, `opacity` to `1` (absent = default, so untouched layers stay byte-light in the JSON blob). **Layer opacity** multiplies over each member element's own opacity in every renderer — canvas, image exports, server snapshots, panel previews.
- `Tab.layers?: Layer[]` — ordered **bottom → top** (index 0 renders lowest). The panel lists them top-first, like every design tool.
- Every element gets an optional `layerId?: string`.
- **Legacy / default:** a tab with no `layers` array behaves as one implicit layer named **"Layer 1"**. The array is materialised lazily on the first layer operation, with the base layer created under a **fixed sentinel id** (`layer:default`) so concurrent clients materialising independently converge. An element with a missing or unknown `layerId` belongs to the default layer (falling back to the bottom layer if the default was deleted).
- Tab bodies are opaque JSON through the api worker and D1 ([Per-tab storage](per-tab-storage.md)), so this needs **no migration, no api-schema change, no worker change** — layers round-trip and sync through the existing tab save + realtime paths. Because the body is opaque, a tab's `layers` is **settled on the way in** (`settleTabFields`, run by the stored-tab migration and on every peer's `tab-meta` patch): a layer without a non-empty string id, or a repeat of an id, is dropped; a missing name reads as "Layer N"; `visible`, `locked` and `opacity` keep only values of their types (opacity clamped to 0..1); a `layers` that is not an array, or keeps no layer, is dropped. The tab's `backgroundColor` and `patternColor` are kept only as strings. A malformed tab is repaired, never refused, so one bad write cannot leave a document that no one can open. The active layer is **per-user UI state**, never persisted or synced.

## Stacking (z-order)

- Render order is **layer bands**: all of layer 0, then all of layer 1, … Within a band, the existing `Tab.elements[]` array order still decides stacking, and frames still paint first **within their band** (a frame on an upper layer sits above everything below that layer).
- The banding is a **stable partition applied at render/export time** (`orderByLayer`); `Tab.elements[]` itself is never re-sorted. New elements are appended to the array as today, i.e. they land **on top of their layer**.
- **Bring to Front / Send to Back are layer moves** — they power the layers, not a per-element z-index. Bring to Front moves the selection onto the **top layer** (and to the top of that band); if the top layer holds anything outside the selection, a **new top layer is created** (same "Layer N" naming) and the selection moves there. Send to Back mirrors onto / below the bottom layer. Already frontmost / backmost = no-op. This is how layers accrue for users who never open the panel. The **selection popover** additionally carries an intra-band z-nudge — **Bring to Front** / **Send to Back** stack the selection within its OWN layer (array order inside the band, `bringManyToFront` / `sendManyToBack`, never a layer change), for the common case of two things overlapping on one layer. The element menu keeps the layer moves; the popover owns the nudge.
- **Pruning:** when one of these two buttons empties a layer (it moved the layer's last element away), that emptied layer is deleted automatically, so casual front/back clicking never litters the panel with abandoned empty layers. Only these two ops prune, and only the layer the moved elements just left — a layer created empty from the panel always sticks around. If the pruned layer was active, the active layer falls back to the top.

## Layer operations

All layer mutations are ordinary tab-body commits: they flow through the normal history (undoable), autosave, and realtime sync.

- **Add** — inserts a new layer **directly above the active layer** (Photoshop's rule) named "Layer N" (first free number), and makes it active.
- **Rename** — inline, double-click the row's name.
- **Delete** — removes the layer **and every element on it**, behind a confirm **popover** anchored to the Delete button (the shared ConfirmPopover; "Delete 'Sketch' and its 12 elements?"); an empty layer deletes without asking. Undo restores both. **The last layer can't be deleted** (control disabled). Deleting the active layer activates its lower neighbour (or the new bottom).
- **Reorder** — drag rows in the panel to restack bands.
- **Merge** — footer **Merge Up / Merge Down** buttons fold the ACTIVE layer into its neighbour, Photoshop-style: the neighbour survives (name + visibility/lock state) and becomes active. Merged-in elements keep their visual position relative to the surviving band — top of the band when merging down, bottom when merging up. Each button is disabled when there's no neighbour in that direction.
- **Visibility** — eye toggle. Hidden layers' elements don't render, can't be hit / marquee'd / select-all'd / Tab-traversed ([Canvas accessibility baseline](../004-interface-design/canvas-accessibility.md)), and drop out of any live selection. Visibility is tab data, so viewers, embeds, and presentations see the same thing.
- **Lock** — padlock toggle. Elements on a locked layer render normally but behave like locked elements: not selectable, not editable, clicks pass through; excluded from marquee and select-all.
- **Opacity** — a 0–100% slider (in the row context menu) dims the whole layer. Slider drags write via tick with ONE history checkpoint per gesture (the colour-setter policy), so a drag is a single undo step.
- **Clear** — empties a layer (same arrow cascade + group-pin freezing as delete) but keeps the layer itself. Confirm popover first.
- **Hide Others** — makes the clicked layer the only visible one, in one step.
- **Smart naming** — a layer still carrying its default "Layer N" name adopts a committed label from its elements. Fires when a label edit COMMITS (blur / Enter), alongside the document + tab auto-renames in commitLabel — never on mid-typing keystrokes (the type-to-edit path commits the first character immediately, which must not name the layer "C"; for the same reason there is deliberately NO "element was previously unlabelled" guard, since that first-keystroke commit would always trip it). Adoption needs the edited element to be the layer's ONLY labelled element, creation-seeded labels (tech icons, templates, paste, AI) never reach commitLabel, and once named (default pattern broken) adoption stops for good.

## Active layer + element membership

- **Exactly one layer is always active** per tab (defaults to the top layer; falls back to the top if the remembered one disappears). Session-scoped, per-device.
- **Every new element lands on the active layer**, whatever created it — palette draw/drop, double-click text, quick-connect arrows, paste, AI insert, template fill, Markdown import. Implemented once at the commit boundary: elements newly appearing in a commit without a valid `layerId` are stamped with the active layer (only once `layers` is materialised), so individual creation paths don't each carry layer logic. Duplicated / copied elements keep their source layer when it still exists on the target tab.
- While the active layer is **hidden or locked**, element creation is blocked (same guard as a locked tab, scoped to the layer): you never add an element you can't immediately see or touch. Paste is a creation path like any other: copied elements, a pasted image or photo, and a pasted or dropped board scene are all refused while the active layer is hidden or locked.
- **Move to layer** — the context menu's existing **Layer** section (single-element and multi-selection menus) gains a labelled **"Move to layer" MenuTile grid** (one tile per layer, top-first, the selection's current layer highlighted — the house tile pattern, [Canvas and palette](../008-canvas/canvas-and-palette.md)), moving the whole selection on click while the menu stays open. Shown only when the tab has more than one layer. Moving preserves the elements' relative order inside the new band.

## The Layers panel

- A standard `MovablePanel` with `PanelId: 'layers'`, participating in corner docking ([Panel corner docking](../007-editor/panel-docking.md)). **Default corner: bottom-right** (above the zoom cluster, which that corner's inset already clears).
- **Roomy, not dense.** The panel is 22rem wide (it used to match the Palette's narrower width, which crushed every control to 12px) and reads like a list of things you own rather than a strip of toggles. Top to bottom:
  - A **header bar**: the layer count ("4 layers") on the left and a brand **New Layer** button on the right (inserts above the active layer, per Add).
  - **Rows**, top layer first, each about 60px tall: a drag **grip** (shown on hover; on touch always) · a **preview** of just that layer's elements, 72 by 48px (rendered with the shared headless SVG renderer, all rows framed by the whole tab's content bounds so content reads in place, like the Map; an empty layer shows a dashed frame instead, so stray layers are easy to spot and prune) · the **name** (double-click to rename) over a quiet **meta line** ("25 elements" or "Empty", then "50% opacity" when dimmed, "Locked" when locked and "Hidden" when hidden) · a **lock toggle** · a **visibility (eye) toggle** · an **ellipsis button** that opens the row menu. The lock and ellipsis show on hover, on keyboard focus, on the active row, and always on touch; a locked layer's padlock stays visible in brand colour. A hidden layer's preview and name fade, so its state reads without hunting for the eye. Every row control is a 32px target with the shared Tooltip.
  - Clicking a row makes it active: a brand-tinted, brand-ringed card whose grip, lock and options stay shown.
  - **Reorder is a pointer-event drag from anywhere on the row** (engaging after a few px of travel so click / double-click still work; not native HTML5 drag-and-drop, which is unreliable in the panel and dead on touch). While dragging, a brand **insertion line** shows where the row will land (above the target when moving up, below it when moving down), and dropping takes the target's slot.
  - With a **single layer** a short hint sits under it ("Layers keep a background, content and notes apart. Add one to stack on top.") so a first visit learns what the panel is for.
  - A **footer** acts on the active layer with labelled buttons: **Merge Up** and **Merge Down** on the left, **Delete** (disabled for the last layer) on the right.
- **Closed by default**: a compact Layers button in the bottom-right cluster, so default chrome is unchanged until you opt in; the button opens the panel and a second press closes it. Edit sessions only (no panel or button for view-role visitors — visibility/lock still apply to what they see, they just can't manage layers); hidden in zen and during the welcome flow.
- **Row context menu**: right-clicking a row (or its ellipsis button) opens a menu hung to the LEFT of the panel (never covering it, clamped on screen), growing up from the clicked row. Every verb is one click away; nothing hides behind a category. Top to bottom:
  - A **header** naming the layer, with its preview and the element count, so the menu says which layer it targets.
  - **Opacity**, the 0-100% slider, always shown.
  - **Show / Hide Layer** · **Lock / Unlock Layer** · **Hide Others** (rows that read their current state).
  - **Bring to Top** · **Send to Bottom** (disabled at that edge).
  - **Merge With Layer Above** · **Merge With Layer Below** (disabled without a neighbour).
  - **Rename** · **Clear Layer** (confirm popover; disabled when empty) · **Delete Layer** (confirm popover on a populated layer; disabled for the last layer).
    Rows are the plain icon-left reading-size rows of the document actions menu, grouped by separators. Right-click also activates the row, so every verb targets the clicked layer.
- **Hover-to-solo**, after the pointer rests on a row for ~1s the canvas renders ONLY that layer (hidden or not, at full band opacity); once engaged, moving across rows switches instantly (like the tooltip warm-up, see [Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md)), and leaving restores the normal view. Pure view state: never persisted, synced, or exported. Governed by a **"Preview Layer on Hover"** user preference ([User preferences](../007-editor/user-preferences.md), default on), which lives with the panel's other two (**Layer Thumbnails**, **Layer Element Counts**) in the Settings dialog under Panels > Layers. They used to sit in a header settings gear alongside a Reset-position row; the gear went when the preferences were centralised, and the header kept its standard Reset-position button. The move-to-layer tiles in the element context menu reuse the same per-layer preview thumbnails as the rows.
- **Blocked-creation notice**: the creation gates stay silent by design, so the moment the ACTIVE layer becomes un-addable (hidden or locked, locally or by activating such a layer) a toast says adding is paused and why. A refused paste repeats that toast every time: a paste is a deliberate keystroke with nothing else on screen to show it was ignored.
- **A popover, not a corner panel** (on a desktop and a phone alike): the **Layers button sits in the bottom-right cluster** and opens the panel as a **popover hanging above it** (`computeDockAnchor(..., 'above')`) rather than docking a panel in the corner. Collaborate does the same. A second press closes it.

### Turning the panel off

**Settings › Panels › Layers › Enable Layers Panel** (`layersPanelEnabled`, [User preferences](../007-editor/user-preferences.md))
removes the Layers panel, its cluster button, the element menus' "Move to layer" tiles and the image
export's "Hidden layers" row. Layers themselves keep working: stacking, visibility, lock, opacity and
the active layer behave exactly as with the panel on.

## Layered templates

Templates whose scaffold stays put while their content moves ship with **pre-assigned layers** ([Canvas and palette](../008-canvas/canvas-and-palette.md)'s catalogue), so a fresh canvas lands with the split a careful user would build by hand: a scaffold band you can lock or hide in one click, and a content band that marquee / select-all sweeps without grabbing the frame behind it.

- The split lives entirely in `@livedesign/templates`: a layered template's builder stamps `layerId` on every element it returns, and `templateCanvasOverrides(kind)` carries the matching `Tab.layers` array (bottom → top, from `templateLayers(kind)` in `template-layers.ts`). All three application paths (the editor picker, `/new`, the MCP worker) already spread that override object onto the tab in the same commit as the elements, so no caller carries layer logic; and because the layers land in the same commit, the commit-boundary stamp (above) sees the template's ids as known and leaves them alone.
- Every layered template shares the same TWO **fixed sentinel ids** (`layer:template:scaffold` under `layer:template:content`, the `layer:default` pattern), not random uuids: re-applying a template converges, and elements copied between any two layered-template tabs keep their band, even across template kinds. Only the display names vary per template.
- The **content layer sits on top**, so it's the default active layer (top-layer rule above) and everything the user adds lands with the content, never under the scaffold. The scaffold ships **named but unlocked**: locking is one click in the panel, and shipping it locked would baffle anyone who just wants to resize a frame.
- Templates without a meaningful scaffold / content split (pages laid out from layouts, lockups, articles) stay layerless and keep the implicit single layer.
- Layered templates and their scaffold / content names (`templateLayers` in `packages/templates/src/template-layers.ts`): **Slide deck** and **Storyboard** Frames / Content · **Floor plan** Rooms / Furniture.

## Exports and snapshots

- **Image / PDF / SVG export** ([Canvas and palette](../008-canvas/canvas-and-palette.md)'s export dialog) skips hidden layers — render loops _and_ content bounds. The dialog's options panel gains a **"Hidden layers"** include-toggle alongside Isometric and Background pattern, rendered **only when at least one layer is hidden**, default off (what you see is what you export).
- **Exports stack like the canvas.** Every export (SVG, PNG / PDF, snapshots, thumbnails, the MCP preview) paints each band in the same order the canvas does: frames first, then everything else in array order, **arrows interleaved with boxes**. They used to paint every box and then every arrow on top (the PNG path above every layer at once), so an arrow sent behind a box on the canvas came out over it.
- Server-rendered SVG snapshots ([Document SVG snapshots](document-snapshots.md) thumbnails / [Live image share link](../013-workspace/live-image-share.md) live image) skip hidden layers too, via the shared renderer.

## Telemetry

Layer interactions are tracked per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (add / delete / rename / reorder / visibility / lock / move-to-layer / panel open), reusing the closed category/action enums, extended only if no existing pair fits. Types are preset enum values, never layer names.

## Out of scope (for now)

- Per-layer opacity, blend modes, layer groups/nesting.
- Persisting or syncing the _active_ layer choice.
- Per-layer permissions.
