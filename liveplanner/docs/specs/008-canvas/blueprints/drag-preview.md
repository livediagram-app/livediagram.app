# Drag preview blueprint

Derived from [Drag preview](../drag-preview.md). Built in two parts: the local preview, then live
drags for collaborators.

## Files

| File                                                    | Role                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/editor/lib/drag-preview.ts`                       | The preview store: local and peer overlays, `useDragPreview`, `applyOverlay`   |
| `apps/editor/hooks/canvas/useEditorDrag.ts`             | Writes ticks to the preview; reads through the virtual tab; commits on release |
| `apps/editor/components/canvas/CanvasElementsLayer.tsx` | Lists the elements; renders for a preview only when it adds or removes some    |
| `apps/editor/hooks/canvas/useLayerDragPreview.ts`       | The layer's preview store: one entry per previewed element and affected arrow  |
| `apps/editor/components/canvas/CanvasElementList.tsx`   | Lists a `PreviewedElement` per element, in paint order                         |
| `apps/editor/components/canvas/PreviewedElement.tsx`    | One element, drawn from its preview entry or the project                       |
| `apps/editor/components/canvas/drag-affected-arrows.ts` | The workbench's `createDragAffectedArrows`, bound to this project's model      |
| `../packages/workbench/src/lib/drag-affected-arrows.ts` | `affectedArrows`, `previewArrowGeometry`: by grids, per frame; shared          |
| `../packages/model-core/src/rect-grid.ts`               | `RectGrid`: rects bucketed by id, asked by neighbourhood; shared               |
| `../packages/workbench/src/lib/drag-ride.ts`            | `ridingElements`: what the preview only translates, by how much; shared        |
| `../packages/workbench/src/lib/drag-ride-dom.ts`        | `createRideWriter`: writes the offsets to nodes or planes, outside React       |
| `apps/editor/hooks/canvas/useCanvasSelectionView.ts`    | Derives the selection from the previewed elements while a preview lasts        |
| `apps/editor/hooks/canvas/useArrowLabelLayouts.ts`      | `draftLayout(arrow, text, elements?)`: lays out a previewed arrow's label      |
| `packages/api-schema/src/room-messages.ts`              | `drag-preview` presence op, in `PRESENCE_OP_KINDS`                             |
| `apps/editor/hooks/collab/useDragPreviewBroadcast.ts`   | Sends the local preview at `DRAG_PREVIEW_SEND_MS`, and its end                 |
| `apps/editor/hooks/collab/peer-drag-previews.ts`        | Receives peers' previews: role check, expiry, cleared by real ops              |

## Domain and naming

| Term            | Identifier         | Meaning                                                                                                       |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Preview         | `DragOverlay`      | `{ tabId, changed: Map<id, Element>, removed: Set<id>, added: { el, after: id \| null }[] }`                  |
| Virtual tab     | `virtualTab(tab)`  | The active tab with the local overlay applied: what the drag logic reads mid-gesture                          |
| Peer preview    | `PeerDragPreview`  | One peer's overlay: `{ presenceId, tabId, patches, at }`                                                      |
| Patch           | `DragPreviewPatch` | `{ id }` plus the geometry a gesture changes (below)                                                          |
| Affected arrows | `affectedArrows`   | Arrows previewed themselves, pinned to a changed element, or whose bounds meet a changed box's old or new box |
| Ride            | `ridingElements`   | The elements the preview only translates, each with its `RideOffset` `{ dx, dy }`                             |
| Ride node       | `data-ride-id`     | A node a riding element's offset is written to: its root, its arrow `<svg>`, its grips                        |
| Ride plane      | `data-ride-plane`  | A node whose children are all ride nodes, which carries a very large move's offset as one layer               |

## Behaviour and state

### The local preview

- `drag-preview.ts` is a module store (the `canvas-gesture.ts` pattern): one local `DragOverlay | null`
  and each peer's raw patches by presence id (`setPeerPreview(presenceId, tabId, patches)`),
  listeners. A peer's patches are resolved at read time against the elements the reader draws
  (`useDragPreview(tabId, elements)`), so the rest of each element is the reader's own. The merged
  result is cached per tab and per element array (a `WeakMap`) and dropped on any change: `Canvas`
  and the element layer read different arrays, and a shared single-entry cache made each read evict
  the other, a fresh object every time and a render loop.
- `setLocalPreview(tabId, next, base)` derives the overlay (`overlayBetween`) by identity against
  `base`, the board as the gesture found it (so a collaborator's change to another element mid-gesture
  is never part of the overlay, and is never undone by it): an element of `next` not
  identical to the project's element of that id is `changed`; an id of `doc` missing from `next`
  is `removed`; an id of `next` missing from `doc` is `added`, `after` the id before it in `next`.
  One linear pass per tick.
- `applyOverlay(elements, overlay)`: the elements with `changed` replaced, `removed` dropped and
  `added` inserted after their `after` (at the start for `null`, at the end when `after` is gone).
  Pure; used for the virtual tab, the selection and the commit.

### The drag hook

- The move effect's local `tick` is `previewTick` (a `useEffectEvent`): at the first tick it records
  `{ tabId, base, virtual }` from the project, then sets `virtual = mapper(virtual)` and calls
  `setLocalPreview(tabId, virtual, base)`. No checkpoint is taken while the gesture lasts. The
  preview lives in a hook-level ref, so it survives the effect re-running within one gesture (a
  quick-connect arrow turning to follow the pointer).
- Every read of `depsRef.current.activeTab` inside the drag effect and the release path goes through
  `virtualTab()`, so snapping and Shift-duplicate see the gesture's own
  result as they saw the written project before.
- The Shift-duplicate swap at the gesture's start writes through the same `tick`.
- On release: a click-to-place arrow turning to follow, or follow mode riding through a release,
  keeps the preview. Every other release reads `virtualTab()` into a snapshot, then
  `commitPreview()` writes it before anything else does, and the release logic runs on the snapshot
  (its `d.tick` / `d.commit` now chain on the committed state, inside the same undo step). The
  placing click in follow mode commits first too. `commitPreview`: `markCheckpoint()` (when the gesture changed anything),
  `deps.tick(els => applyOverlay(els, overlay))`,
  `clearLocalPreview()`.
- The drag effect running with no drag while a preview remains (a route that neither committed nor
  cancelled) commits it.
- Cancel (Escape, a pinch or second touch, unmount): `cancelPreview()`; nothing was written, so
  nothing is restored, so a cancelled pinch never leaves a half-applied move. Escape does not call
  `cancelToCheckpoint`.
- A gesture that changed nothing (a click) commits nothing and logs nothing.

### Drawing

- `CanvasElementsLayer` does not read the overlay itself. `useLayerDragPreview` keeps one
  `LayerPreviewStore` per layer, subscribed to the drag preview (`subscribeDragPreview`) and updated
  in a layout effect when the layer renders with new inputs. On each change it reads the merged
  overlay for the active tab (`dragPreviewFor(tabId, drawnElements)`: the local overlay merged with
  every peer preview, the local one wins on an id) and derives a `PreviewEntry` per changed or added
  element (`{ element }`) and per affected arrow (`{ element, geometry, label? }`), then notifies only
  the ids whose entry changed. The same overlay over the same inputs, or no overlay before and now,
  derives nothing.
- Each listed element is a `PreviewedElement` that reads its own entry (`usePreviewEntry`) and draws
  `entry?.element ?? element`, so a preview frame renders the previewed elements and no other, and
  never the layer.
- The layer reads the store's `structure` (`{ removed, added }`, null while the overlay only changes
  elements), which holds while the same ids are added and removed; it renders only when that
  changes. Paint order comes from the project (`ordered`); with a structure, `shownWithOverlay`
  skips removed ids and puts added elements after their `after` (at the end when it is not drawn).
- Arrow geometry: the memoised per-change map stays as built from the project. For the affected
  arrows only, the frame is `deriveArrowViewFrame(arrow, index)` with `index` the project's index
  overlaid with the changed elements, and the holes are `routeBehindHoles` over the grid's
  candidates minus changed ids plus the changed boxes that meet the arrow's query rect.
- `affectedArrows(overlay, doc)`: previewed arrows, plus arrows pinned to a changed id (a reverse
  map built once per project change), plus arrows whose bounds meet a changed box's old or new box
  (each changed box asks `links.rects`, a `RectGrid` of the arrows' route-behind rects built once
  per project change, `eachRectMeeting`: linear in what moved, never arrows × moved).
- `previewArrowGeometry(arrow, index, grid, overlay, moved, tabFinish)`: `moved` is `movedBoxesGrid(overlay)`,
  an element grid of the changed and added boxes built once per derive; an arrow's holes take the project grid's
  candidates minus the changed and removed ids, plus `queryElementGrid(moved, queryRect)`, instead of every moved
  box.
- Riding (spec "Moves ride an offset"): each derive first takes `ridingElements(overlay, elementIndex,
{ isBoxed, links: arrowLinks })` (`@liveworkspace/workbench/lib/drag-ride`; on a board without
  arrows, which has no `elementIndex`, the board's cached `elementIndexFor(drawnElements)`): a changed boxed
  element whose every field but `x` and `y` is the same value as the project's rides `{ dx: x - x₀, dy: y - y₀ }`;
  then each arrow the gesture changed or pinned to a riding box rides when every field but `from` and `to` is
  unchanged and both ends give the same offset (a free end: its own shift; a pinned end: the same pin, by identity
  or value, to a riding element: that element's offset; any other end kind: none). Every offset is
  `rideOffset(dx, dy)`, rounded to a thousandth of a pixel. No riding box, no ride. A
  riding element gets no entry, and riding arrows are taken out of the affected arrows, so a ride frame notifies
  none of them; with no arrow left to re-route, no preview board is built. `affectedArrows` takes the ride
  (`riding`): when it carries every arrow on the board, no moved box asks the arrow grid.
- `createRideWriter` (`@liveworkspace/workbench/lib/drag-ride-dom`, one per layer store, its root the element
  plane's parent, set by the plane's ref, `attachPlane`): `apply(rides)` puts `style.translate = "<dx>px <dy>px"`
  on every `[data-ride-id="<id>"]` node of each riding id and `''` on the nodes of ids no longer riding. Tagged
  nodes: `BoxedElementView`'s root, the arrow `<svg data-arrow-svg>`, `SelectionChromeLayer`'s portalled box
  (`data-grips-for`) and `ArrowGripsPortal`'s `<g>` (the workbench's grips layer). React never sets `translate`.
- Ride planes (spec "A very large move rides as one layer"): with at least `RIDE_PLANE_MIN_NODES` rides, the
  writer also finds the `[data-ride-plane]` nodes under the root: the element plane (`data-ride-plane`,
  `absolute inset-0`, always: its parent's box) and the grips layer's two hosts. Per plane, the commonest offset,
  when shared by at least `RIDE_PLANE_MIN_NODES` children and more than half of them, is the plane's
  `style.transform = translate(<dx>px, <dy>px)` (no `will-change`, D126); each child gets `translate` = its own
  offset less the plane's. The element plane's CSS (`app/globals.css`): `[data-element-plane] { pointer-events:
none }`, in `@layer base` `[data-element-plane] > * { pointer-events: auto }` and `[data-elements-inert]
[data-element-plane] > * { pointer-events: none }`.
- Dropping the offsets: when the preview ends, the store keeps them while the layer draws the same
  `drawnElements` they were written over; the layout effect of the render that draws another board (the
  release's write) drops them before that paint. A `requestAnimationFrame` set when the preview ends drops them
  at the latest before the next paint (a cancel writes nothing, so nothing renders). A new frame with rides
  cancels that drop.
- Labels of affected arrows are laid out with `draftLayout(arrow, label, virtualElements)`; others
  keep the project's label pass.
- The selection chrome derives the selection (bounds, union resize, quick-connect pluses) from
  `applyOverlay(elements, overlay)` while a preview lasts, so the union handles follow a
  multi-resize: `useCanvasSelectionView(input, tabId)` reads `usePreviewedElements` itself, so
  `Canvas` does not render for a preview frame. The pluses are hidden while a selection moves.

### Live drags (part two)

- `useDragPreviewBroadcast`: while a local preview lasts, at most every `DRAG_PREVIEW_SEND_MS` it
  sends `{ kind: 'drag-preview', tabId, patches }` with one patch per changed element (added and
  removed are not sent: copies appear on release), and `{ kind: 'drag-preview', tabId, end: true }` when it clears, with `landed: true` when the store says the
  preview was written (`clearLocalPreview('landed')`), not cancelled. More than `DRAG_PREVIEW_MAX_ELEMENTS` changed elements → no patches are sent for
  that gesture; collaborators see the result on release.
- A boxed patch carries `x`, `y`, `width`, `height`, `rotation`; an arrow patch `from`, `to`,
  `curveOffset`, `elbowOffset`, `curvePoints`, `labelOffset` (each field the element has).
- Receiving (`peer-drag-previews.ts`, called from `useRoomConnection`): on a `drag-preview` from a
  presence id whose role (kept from the latest presence list) is `edit`, parses the patches
  (`parseDragPreviewPatches`) and sets that peer's preview; on `end` (a landed `end` keeps the preview,
  re-arming the expiry, until the peer's real change), on that peer leaving or the
  room closing, on any element or tab op from that peer (D74), or `PEER_PREVIEW_EXPIRY_MS` after its
  last message, clears it. A sender whose role is not `edit` is dropped and logged once. The room
  drops a non-editor's `drag-preview` too.

## Interfaces and contracts

```ts
// apps/editor/lib/drag-preview.ts
export type DragOverlay = {
  tabId: string;
  changed: ReadonlyMap<string, Element>;
  removed: ReadonlySet<string>;
  added: readonly { el: Element; after: string | null }[];
};
export function setLocalPreview(
  tabId: string,
  next: readonly Element[],
  doc: readonly Element[],
): void;
export function clearLocalPreview(): void;
export function localPreview(): DragOverlay | null;
export function setPeerPreview(
  presenceId: string,
  tabId: string,
  patches: readonly PeerPatch[],
): void;
export function clearPeerPreview(presenceId: string): void;
export function useDragPreview(tabId: string, elements: readonly Element[]): DragOverlay | null;
export function applyOverlay(elements: readonly Element[], overlay: DragOverlay): Element[];

// packages/api-schema/src/room-messages.ts
export type DragPreviewPatch = { id: string } & Partial<
  Pick<BoxedElement, 'x' | 'y' | 'width' | 'height' | 'rotation'> &
    Pick<
      ArrowElement,
      'from' | 'to' | 'curveOffset' | 'elbowOffset' | 'curvePoints' | 'labelOffset'
    >
>;
type DragPreviewOp =
  | { kind: 'drag-preview'; tabId: string; patches: DragPreviewPatch[] }
  | { kind: 'drag-preview'; tabId: string; end: true };
```

- A received op with no `tabId`, a non-array `patches`, more than `DRAG_PREVIEW_MAX_ELEMENTS`
  patches, or a patch whose id is not on the tab is dropped (the rest of the op still applies for
  unknown ids; malformed ops are dropped whole) and logged once per peer.

## Data and persistence

- Nothing new is persisted. The preview is session state; `drag-preview` is presence: never
  logged, ordered or replayed. The project's shape does not change.

## Errors and edge cases

| Case                                                 | Handling                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| The tab changes mid-gesture                          | The drag ends through its existing path; the preview is cleared, not committed       |
| The dragged element is deleted by a peer mid-gesture | Release applies `changed` only for ids still present; the deleted one stays gone     |
| A peer changes another element mid-gesture           | Kept: the commit applies the overlay to the latest elements                          |
| A peer changes the dragged element mid-gesture       | The release overwrites it (last release wins), as today                              |
| Our socket drops mid-gesture                         | Local preview unaffected; peers' copies expire after `PEER_PREVIEW_EXPIRY_MS`        |
| A peer's end message is lost                         | Expiry, or the real element op, clears it                                            |
| Two peers preview the same element                   | Each peer preview is drawn; the later message wins on that id; local wins over peers |
| A view-role sender                                   | Dropped, `[drag-preview] peer ignored`                                               |
| Reduced motion                                       | Unaffected: the preview is the gesture itself                                        |

## Security and trust

- `drag-preview` is a presence kind, relayed from any role, so receivers trust only editors' previews
  (participant `role` from the room's presence list). Patches carry geometry only, validated before
  use; a preview never writes the project.

## Performance and limits

- Per drag frame: one identity pass over the elements (overlay), re-render of the changed elements
  that do not ride and of the affected arrows that do not ride, a grid query per moved box for the
  arrows it crosses, a grid query per affected arrow for the moved boxes that cut it, and one
  `translate` write per node whose offset changed. No index, grid, label pass, Map or
  selection derivation over the whole board, except the selection's `applyOverlay` (linear), made
  once a frame and shared by every chrome reader (`previewedElements`, `sharedCanvasSelection`).
- Once a gesture, not once a frame: the board's index (`elementIndexFor(doc)`, `doc` being the
  same array every frame, in `overlayBetween`) and the arrows the moved boxes crossed where they
  were (`crossedWhereTheyWere` in `affectedArrows`, keyed on the arrow links, the board and the
  changed ids). With no added or removed element, `spreadOverBase(index, elementIndex, changed
ids)` has the preview board's endpoint spread placed from the base's, again only for the fans
  that read a changed id, and in full when a changed arrow joins other pins or an element changes
  kind; equal to placing every fan, by a seeded equivalence test
  (`arrow-endpoint-spread-over.test.ts`).
- 2,000 boxes and 1,999 arrows, every box resized (a union resize, nothing rides): one frame at most 60 ms of
  CPU (`useLayerDragPreview.perf.test.ts`), 16 to 17 ms measured; about 480 ms before the grids (each arrow
  scanned every moved box). A move of all of them rides whole: about 2.5 ms.
- Wire: at most 30 messages a second per dragger, each at most `DRAG_PREVIEW_MAX_ELEMENTS` patches.

## Presentation and UX

- A dragger sees what they see today. A collaborator sees the dragged elements move at up to 30 Hz,
  and the result land on release. No new copy or states.

## Accessibility

- Unchanged: keyboard nudges write at once; the live region announces commits as today.

## Web Experience

- Moves INP for every drag; no effect on LCP or CLS.

## Observability

- `[drag-preview] begin` / `commit` / `cancel` (debug) `{ gesture, count }`.
- `[drag-preview] ride` (debug) `{ count, planes }` when the number of riding elements changes.
- `[drag-preview] peer ignored` (debug) `{ presenceId }`; `[drag-preview] peer expired` (debug);
  `[drag-preview] bad op` (debug, once per peer).

## Testing

| Spec rule                                             | Test                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A gesture draws from a preview, not the project       | `useEditorDrag.preview.test.tsx`: no `deps.tick` during a move; overlay set                                                                                                         |
| One change on release                                 | Same: one `markCheckpoint`, one `deps.tick`, one log schedule; result equals today's                                                                                                |
| A cancel writes nothing                               | Same: Escape and pointercancel leave the project untouched, overlay cleared                                                                                                         |
| Drag logic reads the gesture's own result             | Existing `useEditorDrag.*` suites reading the board as drawn; the drag e2e specs                                                                                                    |
| In a real browser                                     | `e2e/drag-preview.spec.ts`: drawn mid-drag, nothing saved, saved on release; Escape; one undo                                                                                       |
| Overlay derivation and application                    | `drag-preview.test.ts`                                                                                                                                                              |
| What is redrawn                                       | `CanvasElementsLayer.renders.test.tsx`: a preview re-renders the moved element and affected arrows only, never the layer; added and removed elements; `useLayerDragPreview.test.ts` |
| Affected arrows                                       | `drag-affected-arrows.test.ts`; `@liveworkspace/workbench` `drag-affected-arrows.test.ts`; `rect-grid.test.ts` (`@liveworkspace/model-core`)                                        |
| Arrow work linear in what moved                       | `useLayerDragPreview.perf.test.ts` "a union resize of all 2,000 boxes"; the workbench's "the affected arrows' cost"                                                                 |
| Moves ride an offset                                  | `useLayerDragPreview.test.ts`; the workbench's "the ride rules", `drag-ride-dom.test.ts`; `CanvasElementsLayer.renders.test.tsx` "a move riding an offset"                          |
| A very large move rides as one layer                  | `CanvasElementsLayer.renders.test.tsx` "renders no element view for a whole 1,770-element selection"; the workbench's `drag-ride-dom.test.ts`, `SelectionGripsLayer.test.tsx`       |
| Selection follows the preview                         | `usePreviewedElements.test.tsx`; `useCanvasSelectionView.covered.test.ts`: the chrome follows its own tab's preview                                                                 |
| Live movement, expiry, end, real-op clear, role check | `peer-drag-previews.test.ts`, `useDragPreviewBroadcast.test.tsx`                                                                                                                    |
| Presence classification                               | `room-messages` test: `drag-preview` is presence                                                                                                                                    |
| Budget                                                | The probe's drag rows                                                                                                                                                               |

## Constants and configuration

| Constant                    | Value | Provenance | Safe range |
| --------------------------- | ----- | ---------- | ---------- |
| `DRAG_PREVIEW_SEND_MS`      | 33    | Spec       | Spec-fixed |
| `PEER_PREVIEW_EXPIRY_MS`    | 2000  | Spec       | Spec-fixed |
| `DRAG_PREVIEW_MAX_ELEMENTS` | 200   | D71        | 50-1000    |
| `RIDE_PLANE_MIN_NODES`      | 200   | D126       | 50-1000    |

## Defaults ledger

D71 to D74, D123 and D126 in [DEFAULTS.md](DEFAULTS.md).
