# Selection clicks: blueprint

Derived from [Canvas and palette](../canvas-and-palette.md), its "Selection" bullet **Click the
selected element again** and its "Marquee box-select" rules **Only Shift adds to or takes from a
selection** and **A plain click on a member**. The spec decides; this file only adds engineering
precision. Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`. The rules hold on
every tab kind, the whiteboard included.

Scope, by file:

| File                                                     | Role                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/live/lib/selection-click.ts`                       | Pure click rules (`isOnlySelected`, `plainClickOutcome`, `isPlainClick`), `armPlainClick` |
| `apps/live/hooks/canvas/useCanvasSelectHandlers.ts`      | `handleElementClick` settles a click; `handleArrowSelect` applies the rules to arrows     |
| `apps/live/components/canvas/useBoxedElementGestures.ts` | A boxed press arms the click on a selected element; a paired press reselects              |
| `apps/live/hooks/canvas/useBoxedDragHandlers.ts`         | `beginDrag` drops the multi-selection when the pressed element is not a member            |
| `apps/live/components/canvas/ArrowView.tsx`              | The line press passes `paired` (the double-press verdict) to `onSelect`                   |
| `apps/live/components/canvas/BoxedElementView.tsx`       | Threads `onPlainClick` and `isPaintMode` into the gesture hook                            |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`    | Hands `handleElementClick` to every boxed view as `onPlainClick`                          |
| `apps/live/components/canvas/Canvas.tsx`                 | Feeds `selectedId`, `isPaintMode` and `onDeselect` to `useCanvasSelectHandlers`           |
| `apps/live/hooks/ui/useLongPress.ts`                     | Exports `LONG_PRESS_MS`                                                                   |

## Domain and naming

| Term           | Identifier                           | Meaning                                                                          |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| Plain click    | `isPlainClick(press, release)`       | Same pointer, travel under `PRESS_DRAG_SLOP_PX`, and on touch released in time   |
| Only selected  | `isOnlySelected(sel, id)`            | The single selection with no multi-selection, or a multi-selection of just `id`  |
| Click outcome  | `PlainClickOutcome`                  | `deselect` or `select-alone`                                                     |
| Settle a click | `handleElementClick(id)`             | Applies `plainClickOutcome` to the current selection: `onDeselect` or `onSelect` |
| Arm a click    | `armPlainClick(press, onClick)`      | Waits for the press's own release; calls `onClick` when it was a plain click     |
| Click prop     | `BoxedElementViewProps.onPlainClick` | Replaces `multiSelectActive`, which carried the retired sticky add mode          |

## Behaviour and state

**Boxed press** (`handleShapeDown`), after the existing guards (editing, secondary button, remote
lock, vote cast):

1. The press ledger judges the press. A paired press starts nothing (as before); a path opens its
   edit mode; and when the element is not selected (the first click deselected it), it calls
   `onPlainClick(id)`, which selects it again.
2. Shift, element not selected: `onShiftSelect(id)` at once, no drag (unchanged).
3. Shift, element selected: `armPlainClick(e, () => onShiftSelect(id))`, then `onBeginDrag` (the
   deferred toggle and the duplicate drag, unchanged; the release test is now `isPlainClick`).
4. Plain: when the element is selected (`isSelected`, single or member), `armPlainClick(e, () =>
onPlainClick(id))`; then `onBeginDrag(id, 'move', e)` in every case.

`onPlainClick` is only armed or called when `settlesClick` = not paint mode, the prop is present,
and the element is not a `table` (a click inside a selected table picks a cell).

**beginDrag**, after `setSelectedId(id)`: when `multiSelectedIds` is non-empty and lacks `id`, it
is replaced by an empty set, so a plain press on a non-member selects it alone and drags only it. A
member keeps the set, so the drag moves the whole selection.

**Settling** (`handleElementClick(id)`), at the release, against the current selection through a
ref (D57): inert ids are ignored; `isOnlySelected` → `onDeselect()`; otherwise `onSelect(id)`, which
drops the multi-selection. The press never changes membership of an already-selected element, so
the release-time selection equals the press-time selection.

**Arrow press** (`handleArrowSelect(id, e, paired)`): inert ids ignored; Shift → `onShiftSelect`;
not paired, not paint mode and `isOnlySelected` → `armPlainClick(e, () => handleElementClick(id))`
with no selection change at press; otherwise `onSelect(id)` at press (a non-member or a member is
selected alone at once, as before for members). The bend still begins on the same press and engages
only past `PRESS_DRAG_SLOP_PX`, so a bend keeps the arrow selected.

**Double-click on the only selected element**: press 1 arms; release 1 deselects; press 2 pairs, so
it selects again (boxed: step 1; arrow: `paired`); the `dblclick` (boxed) or the release of press 2
(arrow) opens the editor. From an unselected element, press 1 selects and press 2 pairs with the
element already selected, so nothing is settled.

**Unchanged**: the whiteboard's Shift marquee (`useCanvasSurfaceGestures`, `useCanvasPanAndMarquee`)
claims Shift presses in the capture phase before any element sees them.

## Interfaces and contracts

- `isOnlySelected(sel: SelectionSnapshot, id: string): boolean`
- `plainClickOutcome(sel: SelectionSnapshot, id: string): 'select-alone' | 'deselect'`
- `isPlainClick(press: ClickPointer, release: ClickPointer): boolean`
- `armPlainClick(press: ClickPointer, onClick: () => void): void`
- `SelectionSnapshot = { selectedId: string | null; multiSelectedIds: ReadonlySet<string> }`
- `ClickPointer = { clientX; clientY; timeStamp; pointerId; pointerType }`; a React or DOM pointer
  event satisfies it.
- `useCanvasSelectHandlers` gains `isPaintMode`, `selectedId`, `onDeselect`, and returns
  `handleElementClick`; `handleArrowSelect` gains `paired?: boolean`.
- `ArrowViewProps.onSelect(id, e, paired?)`; `BoxedElementViewProps.onPlainClick?(id)`.

## Errors and edge cases

| Case                                              | Handling                                                        |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Release after `PRESS_DRAG_SLOP_PX` of travel      | A drag: nothing settled                                         |
| `pointercancel` (pinch, lost pointer)             | Listener removed; nothing settled                               |
| Another pointer's release                         | Ignored; the armed press keeps waiting for its own              |
| Touch held to `LONG_PRESS_MS`                     | Not a click: the long-press context menu owns it                |
| Slow mouse click                                  | Still a click; no time limit off touch (D58)                    |
| Format painter or Format tool armed               | Never armed: the press paints                                   |
| Selected table                                    | Never armed: the click picks a cell                             |
| Remotely locked, editing, vote cast, right button | Returned before arming (existing guards)                        |
| Hidden or locked layer                            | `handleElementClick` and `handleArrowSelect` ignore inert ids   |
| Multi-selection of one                            | Counts as the only selected element: a plain click deselects it |

## Observability

- `console.debug('[select-click]', id, outcome)` on every settled click.
- The existing `[double-press]` line marks the paired press that reselects.

## Testing

| Rule                                        | Test                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Only selected, outcome, plain click, arming | `apps/live/lib/selection-click.test.ts`                                  |
| Boxed press arming per kind, Shift, paint   | `apps/live/components/canvas/useBoxedElementGestures.selection.test.tsx` |
| Double-click from selected and unselected   | same file                                                                |
| Non-member press drops the multi-selection  | `apps/live/hooks/canvas/useEditorDrag.select-press.test.tsx`             |
| Settling, arrows, paint mode, inert         | `apps/live/hooks/canvas/useCanvasSelectHandlers.test.tsx`                |
| End to end in a browser                     | `apps/live/e2e/select-clicks.spec.ts`                                    |

## Constants and configuration

- `PRESS_DRAG_SLOP_PX = 4` (`lib/press-gestures.ts`), the engage threshold of every body drag.
- `LONG_PRESS_MS = 500` (`hooks/ui/useLongPress.ts`).

## Defaults ledger

- D57: the release settles against the selection at release time.
- D58: a mouse or pen click has no time limit.
