# Drag preview blueprint

Derived from [Drag preview](../drag-preview.md). Built in two parts: the local preview, then live
drags for collaborators.

## Files

| File                                                          | Role                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/live/lib/drag-preview.ts`                               | The preview store: local and peer overlays, `useDragPreview`, `applyOverlay`   |
| `apps/live/hooks/canvas/useEditorDrag.ts`                     | Writes ticks to the preview; reads through the virtual tab; commits on release |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`         | Draws each element through the overlay; re-derives only the affected arrows    |
| `apps/live/components/canvas/drag-affected-arrows.ts`         | `affectedArrows`: arrows pinned to, or crossing, a previewed box               |
| `apps/live/components/canvas/Canvas.tsx`                      | Derives the selection from the previewed elements while a preview lasts        |
| `apps/live/hooks/canvas/useArrowLabelLayouts.ts`              | `draftLayout(arrow, text, elements?)`: lays out a previewed arrow's label      |
| `packages/api-schema/src/room-messages.ts`                    | `drag-preview` presence op, in `PRESENCE_OP_KINDS`                             |
| `apps/live/hooks/collab/useDragPreviewBroadcast.ts` (planned) | Sends the local preview at `DRAG_PREVIEW_SEND_MS`, and its end                 |
| `apps/live/hooks/collab/usePeerDragPreviews.ts` (planned)     | Receives peers' previews: role check, expiry, cleared by real ops              |

## Domain and naming

| Term            | Identifier         | Meaning                                                                                                       |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Preview         | `DragOverlay`      | `{ tabId, changed: Map<id, Element>, removed: Set<id>, added: { el, after: id \| null }[] }`                  |
| Virtual tab     | `virtualTab(tab)`  | The active tab with the local overlay applied: what the drag logic reads mid-gesture                          |
| Peer preview    | `PeerDragPreview`  | One peer's overlay: `{ presenceId, tabId, patches, at }`                                                      |
| Patch           | `DragPreviewPatch` | `{ id }` plus the geometry a gesture changes (below)                                                          |
| Affected arrows | `affectedArrows`   | Arrows previewed themselves, pinned to a changed element, or whose bounds meet a changed box's old or new box |

## Behaviour and state

### The local preview

- `drag-preview.ts` is a module store (the `canvas-gesture.ts` pattern): one local `DragOverlay | null`
  and a map of peer previews by presence id, a version number bumped on every change, listeners.
- `setLocalPreview(tabId, next, base)` derives the overlay (`overlayBetween`) by identity against
  `base`, the board as the gesture found it (so a collaborator's change to another element mid-gesture
  is never part of the overlay, and is never undone by it): an element of `next` not
  identical to the document's element of that id is `changed`; an id of `doc` missing from `next`
  is `removed`; an id of `next` missing from `doc` is `added`, `after` the id before it in `next`.
  One linear pass per tick.
- `applyOverlay(elements, overlay)`: the elements with `changed` replaced, `removed` dropped and
  `added` inserted after their `after` (at the start for `null`, at the end when `after` is gone).
  Pure; used for the virtual tab, the selection and the commit.

### The drag hook

- The move effect's local `tick` is `previewTick` (a `useEffectEvent`): at the first tick it records
  `{ tabId, base, virtual }` from the document, then sets `virtual = mapper(virtual)` and calls
  `setLocalPreview(tabId, virtual, base)`. No checkpoint is taken while the gesture lasts. The
  preview lives in a hook-level ref, so it survives the effect re-running within one gesture (a
  quick-connect arrow turning to follow the pointer).
- Every read of `depsRef.current.activeTab` inside the drag effect and the release path goes through
  `virtualTab()`, so snapping, lanes, insert-between and Shift-duplicate see the gesture's own
  result as they saw the written document before.
- The Shift-duplicate swap at the gesture's start writes through the same `tick`.
- On release: a click-to-place arrow turning to follow, or follow mode riding through a release,
  keeps the preview. Every other release reads `virtualTab()` into a snapshot, then
  `commitPreview()` writes it before anything else does, and the release logic runs on the snapshot
  (its `d.tick` / `d.commit` now chain on the committed state, inside the same undo step). The
  placing click in follow mode commits first too. `commitPreview`: `markCheckpoint()` (when the gesture changed anything),
  `deps.tick(els => applyOverlay(els, overlay))`, `scheduleElementChangeLog('element-drag', ...)`,
  `clearLocalPreview()`.
- The drag effect running with no drag while a preview remains (a route that neither committed nor
  cancelled) commits it, matching the old behaviour where every tick was a write.
- Cancel (Escape, a pinch or second touch, unmount): `cancelPreview()`; nothing was written, so
  nothing is restored (a cancelled pinch used to leave a half-applied move). Escape no longer calls
  `cancelToCheckpoint`.
- A gesture that changed nothing (a click) commits nothing and logs nothing.

### Drawing

- `CanvasElementsLayer` reads `useDragPreview()` for the active tab: the local overlay merged with
  every peer preview (the local one wins on an id). Paint order comes from the document (`ordered`,
  unchanged); each element is drawn as `overlay.changed.get(id) ?? element`, removed ids are
  skipped, and added elements follow their `after`.
- Arrow geometry: the memoised per-change map stays as built from the document. For the affected
  arrows only, the frame is `deriveArrowViewFrame(arrow, index)` with `index` the document's index
  overlaid with the changed elements, and the holes are `routeBehindHoles` over the grid's
  candidates minus changed ids plus the changed boxes that meet the arrow's query rect.
- `affectedArrows(overlay, doc)`: previewed arrows, plus arrows pinned to a changed id (a reverse
  map built once per document change), plus arrows whose bounds meet a changed box's old or new box
  (a linear pass over the arrows' bounds, built once per document change).
- Labels of affected arrows are laid out with `draftLayout(arrow, label, virtualElements)`; others
  keep the document's label pass.
- `Canvas` derives the selection (bounds, union resize, quick-connect pluses) from
  `applyOverlay(elements, overlay)` while a preview lasts, so the union handles follow a
  multi-resize.

### Live drags (part two)

- `useDragPreviewBroadcast`: while a local preview lasts, at most every `DRAG_PREVIEW_SEND_MS` it
  sends `{ kind: 'drag-preview', tabId, patches }` with one patch per changed element (added and
  removed are not sent: copies appear on release), and `{ kind: 'drag-preview', tabId, end: true }`
  when it clears. More than `DRAG_PREVIEW_MAX_ELEMENTS` changed elements → no patches are sent for
  that gesture; collaborators see the result on release.
- A boxed patch carries `x`, `y`, `width`, `height`, `rotation`; an arrow patch `from`, `to`,
  `curveOffset`, `elbowOffset`, `curvePoints`, `labelOffset` (fields present only when changed).
- `usePeerDragPreviews`: on a `drag-preview` from a presence id whose participant role is `edit`,
  sets that peer's preview (patches applied to the document's elements give `changed`); on `end`,
  on that peer leaving, on an element op for any of its ids, or `PEER_PREVIEW_EXPIRY_MS` after its
  last message, clears it. A sender whose role is not `edit` is dropped and logged.

## Interfaces and contracts

```ts
// apps/live/lib/drag-preview.ts
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
export function setPeerPreview(presenceId: string, overlay: DragOverlay): void;
export function clearPeerPreview(presenceId: string): void;
export function useDragPreview(tabId: string): DragOverlay | null; // merged; null when none
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
  logged, ordered or replayed. The document's shape does not change.

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
  use; a preview never writes the document.

## Performance and limits

- Per drag frame: one identity pass over the elements (overlay), re-render of the changed elements
  and affected arrows, one linear pass over arrow bounds. No index, grid, label pass, Map or
  selection derivation over the whole board, except the selection's `applyOverlay` (linear).
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
- `[drag-preview] peer ignored` (debug) `{ presenceId }`; `[drag-preview] peer expired` (debug);
  `[drag-preview] bad op` (debug, once per peer).

## Testing

| Spec rule                                             | Test                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A gesture draws from a preview, not the document      | `useEditorDrag.preview.test.tsx`: no `deps.tick` during a move; overlay set                             |
| One change on release                                 | Same: one `markCheckpoint`, one `deps.tick`, one log schedule; result equals today's                    |
| A cancel writes nothing                               | Same: Escape and pointercancel leave the document untouched, overlay cleared                            |
| Drag logic reads the gesture's own result             | Existing `useEditorDrag.*` suites reading the board as drawn; the drag e2e specs                        |
| In a real browser                                     | `e2e/drag-preview.spec.ts`: drawn mid-drag, nothing saved, saved on release; Escape; one undo           |
| Overlay derivation and application                    | `drag-preview.test.ts`                                                                                  |
| What is redrawn                                       | `CanvasElementsLayer.renders.test.tsx`: a preview re-renders the moved element and affected arrows only |
| Affected arrows                                       | `drag-affected-arrows.test.ts`                                                                          |
| Selection follows the preview                         | `usePreviewedElements.test.tsx`                                                                         |
| Live movement, expiry, end, real-op clear, role check | `usePeerDragPreviews.test.tsx`, `useDragPreviewBroadcast.test.tsx`                                      |
| Presence classification                               | `room-messages` test: `drag-preview` is presence                                                        |
| Budget                                                | The probe's drag rows                                                                                   |

## Constants and configuration

| Constant                    | Value | Provenance | Safe range |
| --------------------------- | ----- | ---------- | ---------- |
| `DRAG_PREVIEW_SEND_MS`      | 33    | Spec       | Spec-fixed |
| `PEER_PREVIEW_EXPIRY_MS`    | 2000  | Spec       | Spec-fixed |
| `DRAG_PREVIEW_MAX_ELEMENTS` | 200   | D71        | 50-1000    |

## Defaults ledger

D71 to D73 in [DEFAULTS.md](DEFAULTS.md).
