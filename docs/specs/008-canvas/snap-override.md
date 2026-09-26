# Snap override (free drag)

Holding **Cmd / Ctrl while dragging** turns off alignment snapping and its
guide lines for that gesture, so an element (or arrow endpoint) follows the
pointer exactly and can be placed off-grid.

## Behaviour

- Default: dragging an element snaps its edges / centres to neighbours and to
  equal spacing (distribution), drawing the faint guide lines that explain the
  match. Unchanged.
- While **Cmd (⌘) / Ctrl** is held during a drag:
  - no alignment or distribution snap is applied — the element tracks the raw
    pointer delta;
  - no guide lines are drawn (they're cleared for the gesture).
- It's a **per-drag override**, read live from the move event, so pressing or
  releasing the key mid-drag flips snapping on the next move. The next drag
  snaps as usual — nothing to toggle back.
- Applies to a single element, a multi-selection move, and a dragged **arrow
  endpoint** (both share the snap sites in `useEditorDrag`).
- **Insert between wins over it.** On an event-storming board, Alt opens an
  insertion slot ([Event storming](../021-event-storming/event-storming.md)); while one is open the
  slot IS the placement, so holding Cmd/Ctrl as well changes nothing — free
  placement is meaningless against a gap the board has already opened, and
  two placement rules at once would put the note, the insertion marker and
  the drop in three different places. Release Alt and this override applies
  again for the rest of the drag, as usual.
- **It is the one way off a lane.** On an event-storming board a workshop note
  always lands on a lane ([Event storming](../021-event-storming/event-storming.md#always-on-a-lane));
  Cmd/Ctrl skips the lanes with every other snap, and the note stays exactly
  where it was put: no later load, settle or nudge re-snaps it on its own
  (an up / down arrow key does move it, to the next lane on that side).

## Implementation

`useEditorDrag`'s `onMove` reads `noSnap = e.metaKey || e.ctrlKey` and gates the
two `snapToAlignment` sites (boxed move + free arrow endpoint) on `!noSnap`.
Each site's existing `else` branch already clears the guides and falls back to
the raw position, so the override needed no new clearing path. The separate
"alignment guides off" preference (`alignmentGuidesRef`) is unrelated: it hides
the guide lines but keeps snapping; this hides both.

Documented for users in the help centre at `canvas/snapping` ([Help app](../018-help/help-app.md)), with a
`SnappingGuides` illustration.
