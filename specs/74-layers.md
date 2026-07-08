# Layers

Photoshop-style layers per tab: named stacking bands that elements belong to, managed from a floating Layers panel. Layers give big diagrams structure (background / content / annotations), let you hide or freeze whole slices of a tab, and make z-order deliberate instead of an accident of insertion order.

## Data model (`@livediagram/diagram`)

- `Layer = { id: string; name: string; visible?: boolean; locked?: boolean }`. `visible` defaults to `true`, `locked` to `false` (absent = default, so untouched layers stay byte-light in the JSON blob).
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
- **Delete** — removes the layer **and every element on it**, behind a confirm dialog stating the element count ("Delete 'Sketch' and its 12 elements?"); an empty layer deletes without the dialog. Undo restores both. **The last layer can't be deleted** (control disabled). Deleting the active layer activates its lower neighbour (or the new bottom).
- **Reorder** — drag rows in the panel to restack bands.
- **Visibility** — eye toggle. Hidden layers' elements don't render, can't be hit / marquee'd / select-all'd / Tab-traversed (spec/71), and drop out of any live selection. Visibility is tab data, so viewers, embeds, and presentations see the same thing.
- **Lock** — padlock toggle. Elements on a locked layer render normally but behave like locked elements: not selectable, not editable, clicks pass through; excluded from marquee and select-all.

## Active layer + element membership

- **Exactly one layer is always active** per tab (defaults to the top layer; falls back to the top if the remembered one disappears). Session-scoped, per-device.
- **Every new element lands on the active layer**, whatever created it — palette draw/drop, double-click text, quick-connect arrows, paste, AI insert, template fill, Mermaid import. Implemented once at the commit boundary: elements newly appearing in a commit without a valid `layerId` are stamped with the active layer (only once `layers` is materialised), so individual creation paths don't each carry layer logic. Duplicated / copied elements keep their source layer when it still exists on the target tab.
- While the active layer is **hidden or locked**, element creation is blocked (same guard as a locked tab, scoped to the layer) — you never add an element you can't immediately see or touch.
- **Move to layer** — the context menu's existing **Layer** section (single-element and multi-selection menus) gains a row showing the element's current layer with a dropdown (`PaletteDropdown`) to move it — the whole selection moves together. Shown only when the tab has more than one layer. Moving preserves the elements' relative order inside the new band.

## The Layers panel

- A standard `MovablePanel` with `PanelId: 'layers'`, participating in corner docking (spec/63). **Default corner: bottom-right** (above the zoom cluster, which that corner's inset already clears).
- Rows top layer first: eye toggle · name (double-click to rename) · lock toggle · per-row drag handle for reorder. Clicking a row makes it active (brand highlight). Each row shows its element count. Footer: **Add layer** + **Delete layer** (disabled for the last layer). All icon controls use the shared Tooltip.
- **Minimised by default** into a compact Layers dock button in the bottom-right cluster (exactly the minimised Activity panel pattern) so default chrome is unchanged until you opt in; the button expands the panel, the header collapses it back. Edit sessions only (no panel or button for view-role visitors — visibility/lock still apply to what they see, they just can't manage layers); hidden in zen and during the welcome flow.
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
