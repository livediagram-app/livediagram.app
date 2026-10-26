# Layers

A tab's elements belong to named stacking bands, its **layers**. liveplanner keeps the layer model and every rule
that reads it (stacking, visibility, lock, opacity, the active layer), but shows **no Layers panel and no Layers
button**: Plan has neither ([Plan mode](../026-plan/plan-mode.md) "No Layers panel, Map or Tidy Up"), and no Plan
template ships layers. A tab gets layers by arriving with them (an import, a paste, an agent's elements); otherwise
it is one implicit layer.

## Active layer: the fallback must be usable

An explicit choice of active layer is honoured even when that layer is hidden or locked, and the editor toasts why
creation is paused rather than moving the person somewhere they did not ask to be. The fallback (no stored choice)
skips hidden and locked layers and lands on the topmost usable one (`resolveActiveLayerId`), so a tab whose top layer
is hidden never silently refuses every create.

## Data model (`@liveplanner/project`)

- `Layer = { id: string; name: string; visible?: boolean; locked?: boolean; opacity?: number }`. `visible` defaults to
  `true`, `locked` to `false`, `opacity` to `1` (absent means default, so untouched layers stay light in the JSON).
  **Layer opacity** multiplies over each member element's own opacity in every renderer: the canvas, image exports and
  server snapshots.
- `Tab.layers?: Layer[]`, ordered **bottom to top** (index 0 renders lowest).
- Every element has an optional `layerId?: string`; one naming no layer resolves to the base layer (`resolveLayerId`).
- **Default:** a tab with no `layers` array is one implicit layer named **"Layer 1"** (`tabLayers`). The array is
  materialised on the first layer operation (`materializeLayers`), the base layer under the fixed id `layer:default`,
  so two clients materialising independently converge.
- Tab bodies are opaque JSON through the api worker and the plan's store ([Per-tab storage](per-tab-storage.md)), so
  layers round-trip and sync through the ordinary tab save and realtime paths.

## Stacking (z-order)

- Render order is **layer bands**: all of layer 0, then all of layer 1, and so on (`layerBands`,
  `packages/project/src/layers.ts`). Within a band, `Tab.elements[]` order decides stacking, with the paint tiers the
  same file names: frames first, then everything else, attached badges last.
- The banding is applied at render and export time; `Tab.elements[]` is never re-sorted. A new element is appended, so
  it lands on top of its layer.
- **Bring to Front / Send to Back are layer moves** (`bringElementsToFrontLayer`, `sendElementsToBackLayer` in
  `layer-operations.ts`, from the element menu through `useElementStyle`). Bring to Front moves the selection onto the
  top layer, at the top of that band; when the top layer holds anything outside the selection, a new top layer is made
  ("Layer N") and the selection moves there. Send to Back mirrors it at the bottom. A layer either move empties is
  deleted; no other operation prunes. The selection toolbar's own Bring to Front restacks within the band.

## Rules every surface keeps

- **Hidden** layers' elements do not render, cannot be hit, swept or selected, and drop out of a live selection
  (`hiddenLayerElementIds`, `visibleLayerElements`).
- **Locked** layers' elements render but behave as locked elements: not selectable, not editable, clicks pass through
  (`lockedLayerElementIds`).
- **Every new element lands on the active layer**, whatever made it (`stampNewElementLayers`, applied once at the
  commit boundary). While the active layer is hidden or locked, creating is blocked, as on a locked tab, and a toast
  says why (`explainCreateBlocked`, `blockedLayerMessage`).
- **Smart naming:** a layer still named "Layer N" adopts a label committed on one of its elements
  (`adoptLayerNameFromLabel`, on commit, never mid-typing).
- **Exactly one layer is active** per tab, session-scoped and never synced (`useLayersState`,
  `apps/editor/app/project/[id]/useLayersState.ts`).

## What the editor offers

- The element menu's **Move to layer** row (`components/palette/MoveToLayerRow.tsx`): one tile per layer, top first,
  the selection's current layer marked. Shown while `layersPanelEnabled` is not stored `false`
  ([User preferences](../007-editor/user-preferences.md)); Settings has no row for it, so it is on.
- The image export's **Hidden layers** row, under the same preference (`offerHiddenLayers`, `ExportTabDialog`).
- The editor state carries every layer operation (add, rename, delete, reorder, merge, visibility, lock, opacity,
  clear, hide others, preview) through `useLayersState` to `Canvas`'s props, for a layers surface to call; no Plan
  surface renders one, so in liveplanner only Move to layer, Bring to Front and Send to Back reach them.

## Exports and snapshots

- Image, PDF and SVG exports skip hidden layers, in the render loop and the content bounds, unless the export's
  Hidden layers row includes them.
- Every export (SVG, PNG and PDF, snapshots, thumbnails, the MCP preview) paints the bands in the canvas's order.
- Server-rendered snapshots ([Project SVG snapshots](project-snapshots.md),
  [Live image share link](../013-workspace/live-image-share.md)) skip hidden layers too, through the shared renderer.

## Telemetry

`Layer` events from `useLayersState`: `Selected`, `Added`, `Renamed·Manual`, `Renamed·Adopted`, `Deleted`,
`Reordered`, `Moved` (Move to layer), `Removed·MergedUp` / `MergedDown`, `Toggled·Shown` / `Hidden` / `Locked` /
`Unlocked` / `OthersHidden`, `Changed·Opacity`, `Cleared`; Bring to Front and Send to Back count as
`Element·Reordered·Front` / `Back` ([Telemetry](../017-telemetry/telemetry.md)).

## Testing

`packages/project/src/layers.test.ts` (bands, gates, every operation), `apps/editor/hooks/canvas/useClipboard.layer-blocked.test.tsx` (a paste onto a blocked layer),
`apps/editor/hooks/canvas/useElementStyle.test.ts` (Bring to Front as a layer move).

## Out of scope

- Blend modes, layer groups or nesting.
- Persisting or syncing the active layer.
- Per-layer permissions.
