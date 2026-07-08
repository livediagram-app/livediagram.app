# Layers

Photoshop-style layers per tab: named stacking bands that elements belong to, managed from a floating Layers panel. Layers give big diagrams structure (background / content / annotations), let you hide or freeze whole slices of a tab, and make z-order deliberate instead of an accident of insertion order.

## Data model (`@livediagram/diagram`)

- `Layer = { id: string; name: string; visible?: boolean; locked?: boolean; opacity?: number }`. `visible` defaults to `true`, `locked` to `false`, `opacity` to `1` (absent = default, so untouched layers stay byte-light in the JSON blob). **Layer opacity** multiplies over each member element's own opacity in every renderer — canvas, image exports, server snapshots, panel previews.
- `Tab.layers?: Layer[]` — ordered **bottom → top** (index 0 renders lowest). The panel lists them top-first, like every design tool.
- Every element gets an optional `layerId?: string`.
- **Legacy / default:** a tab with no `layers` array behaves as one implicit layer named **"Layer 1"**. The array is materialised lazily on the first layer operation, with the base layer created under a **fixed sentinel id** (`layer:default`) so concurrent clients materialising independently converge. An element with a missing or unknown `layerId` belongs to the default layer (falling back to the bottom layer if the default was deleted).
- Tab bodies are opaque JSON through the api worker and D1 (spec/13), so this needs **no migration, no api-schema change, no worker change** — layers round-trip and sync through the existing tab save + realtime paths. The active layer is **per-user UI state**, never persisted or synced.

## Stacking (z-order)

- Render order is **layer bands**: all of layer 0, then all of layer 1, … Within a band, the existing `Tab.elements[]` array order still decides stacking, and frames still paint first **within their band** (a frame on an upper layer sits above everything below that layer).
- The banding is a **stable partition applied at render/export time** (`orderByLayer`); `Tab.elements[]` itself is never re-sorted. New elements are appended to the array as today, i.e. they land **on top of their layer**.
- **Bring to Front / Send to Back are layer moves** — they power the layers, not a per-element z-index. Bring to Front moves the selection onto the **top layer** (and to the top of that band); if the top layer holds anything outside the selection, a **new top layer is created** (same "Layer N" naming) and the selection moves there. Send to Back mirrors onto / below the bottom layer. Already frontmost / backmost = no-op. This is how layers accrue for users who never open the panel — there is no intra-band z-nudge in the UI.
- **Pruning:** when one of these two buttons empties a layer (it moved the layer's last element away), that emptied layer is deleted automatically, so casual front/back clicking never litters the panel with abandoned empty layers. Only these two ops prune, and only the layer the moved elements just left — a layer created empty from the panel always sticks around. If the pruned layer was active, the active layer falls back to the top.

## Layer operations

All layer mutations are ordinary tab-body commits: they flow through the normal history (undoable), autosave, and realtime sync.

- **Add** — inserts a new layer **directly above the active layer** (Photoshop's rule) named "Layer N" (first free number), and makes it active.
- **Rename** — inline, double-click the row's name.
- **Delete** — removes the layer **and every element on it**, behind a confirm **popover** anchored to the Delete button (the shared ConfirmPopover; "Delete 'Sketch' and its 12 elements?"); an empty layer deletes without asking. Undo restores both. **The last layer can't be deleted** (control disabled). Deleting the active layer activates its lower neighbour (or the new bottom).
- **Reorder** — drag rows in the panel to restack bands.
- **Merge** — footer **Merge Up / Merge Down** buttons fold the ACTIVE layer into its neighbour, Photoshop-style: the neighbour survives (name + visibility/lock state) and becomes active. Merged-in elements keep their visual position relative to the surviving band — top of the band when merging down, bottom when merging up. Each button is disabled when there's no neighbour in that direction.
- **Visibility** — eye toggle. Hidden layers' elements don't render, can't be hit / marquee'd / select-all'd / Tab-traversed (spec/71), and drop out of any live selection. Visibility is tab data, so viewers, embeds, and presentations see the same thing.
- **Lock** — padlock toggle. Elements on a locked layer render normally but behave like locked elements: not selectable, not editable, clicks pass through; excluded from marquee and select-all.
- **Opacity** — a 0–100% slider (in the row context menu) dims the whole layer. Slider drags write via tick with ONE history checkpoint per gesture (the colour-setter policy), so a drag is a single undo step.
- **Clear** — empties a layer (same arrow cascade + group-pin freezing as delete) but keeps the layer itself. Confirm popover first.
- **Hide Others** — makes the clicked layer the only visible one, in one step.
- **Smart naming** — a layer still carrying its default "Layer N" name adopts the FIRST label the user types onto one of its existing elements. Fires when the label edit COMMITS (blur / Enter), alongside the diagram + tab auto-renames in commitLabel — never on mid-typing keystrokes (the type-to-edit path commits the first character immediately, which must not name the layer "C"). Creation-seeded labels (tech icons, templates, paste, AI) never trigger it, and a layer with any labelled element keeps its name.

## Active layer + element membership

- **Exactly one layer is always active** per tab (defaults to the top layer; falls back to the top if the remembered one disappears). Session-scoped, per-device.
- **Every new element lands on the active layer**, whatever created it — palette draw/drop, double-click text, quick-connect arrows, paste, AI insert, template fill, Mermaid import. Implemented once at the commit boundary: elements newly appearing in a commit without a valid `layerId` are stamped with the active layer (only once `layers` is materialised), so individual creation paths don't each carry layer logic. Duplicated / copied elements keep their source layer when it still exists on the target tab.
- While the active layer is **hidden or locked**, element creation is blocked (same guard as a locked tab, scoped to the layer) — you never add an element you can't immediately see or touch.
- **Move to layer** — the context menu's existing **Layer** section (single-element and multi-selection menus) gains a labelled **"Move to layer" MenuTile grid** (one tile per layer, top-first, the selection's current layer highlighted — the house tile pattern, spec/09), moving the whole selection on click while the menu stays open. Shown only when the tab has more than one layer. Moving preserves the elements' relative order inside the new band.

## The Layers panel

- A standard `MovablePanel` with `PanelId: 'layers'`, participating in corner docking (spec/63). **Default corner: bottom-right** (above the zoom cluster, which that corner's inset already clears).
- Rows top layer first: eye toggle · a **mini preview of just that layer's elements** (rendered with the shared headless SVG renderer, all rows framed by the whole tab's content bounds so content reads in place, like the Map) · name (double-click to rename) · a passive padlock indicator when the layer is locked · an **ellipsis button** that opens the row menu (lock, restack, and the rest live there, not as row buttons). Clicking a row makes it active (brand highlight). **Reorder is a pointer-event drag from anywhere on the row** (engaging after a few px of travel so click / double-click still work; not native HTML5 drag-and-drop, which is unreliable in the panel and dead on touch): drop on a row to take its slot. Footer: **Merge Up** + **Merge Down** on the LEFT, **Add** + a red **Delete Layer** (disabled for the last layer) on the RIGHT. All icon controls use the shared Tooltip. The panel matches the Palette's width.
- **Minimised by default** into a compact Layers dock button in the bottom-right cluster (exactly the minimised Activity panel pattern) so default chrome is unchanged until you opt in; the button expands the panel, the header collapses it back. Edit sessions only (no panel or button for view-role visitors — visibility/lock still apply to what they see, they just can't manage layers); hidden in zen and during the welcome flow.
- **Row context menu** — right-clicking a row (or its ellipsis button) opens a tab-menu-style menu hung to the LEFT of the panel (never covering it), growing up from the clicked row: a quick-verbs toolbar (Rename pencil + red Delete trash, confirm popover on a populated layer) over collapsible categories — **Layer** (opacity slider · Bring to Top · Send to Back · Hide Others), **Content** (Lock toggle · Clear with confirm), **Merge** (With Layer Above / Below, disabled without a neighbour). Right-click also activates the row, so every verb targets the clicked layer.
- **Hover-to-solo** — after the pointer rests on a row for ~1s the canvas renders ONLY that layer (hidden or not, at full band opacity); once engaged, moving across rows switches instantly (tooltip-chain style), and leaving restores the normal view. Pure view state: never persisted, synced, or exported. Governed by a **"Preview layer on hover"** user preference (spec/20, default on) in the panel's header **settings gear** — which also carries the Reset-position row (bottom), mirroring the Palette / Map gear popovers. The gear is desktop-only chrome (headerActions never renders in the dock popover), fitting since hover doesn't exist on touch. The move-to-layer tiles in the element context menu reuse the same per-layer preview thumbnails as the rows.
- **Blocked-creation notice** — the creation gates stay silent by design, so the moment the ACTIVE layer becomes un-addable (hidden or locked, locally or by activating such a layer) a toast says adding is paused and why.
- **Mobile / minimal panel layout:** the panel collapses into a **Layers button in the `CanvasMobileDock` row**, opening as an anchored popover like Explorer / Palette / Collaborate — the feature stays fully usable in both modes. (Relatedly, the Minimap now doesn't render at all in minimal layout — see spec/59.)

## Exports, Mermaid, snapshots

- **Image / PDF / SVG export** (spec/09's export dialog) skips hidden layers — render loops _and_ content bounds. The dialog's options panel gains a **"Hidden layers"** include-toggle alongside Isometric and Background pattern, rendered **only when at least one layer is hidden**, default off (what you see is what you export).
- **Mermaid export** (spec/73) skips hidden layers. Mermaid **import** lands on the active layer via the commit-boundary rule.
- Server-rendered SVG snapshots (spec/67 thumbnails / spec/54 live image) skip hidden layers too, via the shared renderer.

## Telemetry

Layer interactions are tracked per spec/22 (add / delete / rename / reorder / visibility / lock / move-to-layer / panel open), reusing the closed category/action enums, extended only if no existing pair fits. Types are preset enum values, never layer names.

## Out of scope (for now)

- Per-layer opacity, blend modes, layer groups/nesting.
- Persisting or syncing the _active_ layer choice.
- Per-layer permissions.
