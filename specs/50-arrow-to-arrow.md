# 50 — Arrow-to-arrow connections

An arrow's endpoint can connect to a point **along another arrow's line**, not
just to a shape anchor. This is the sequence-diagram pattern: messages attach to
a lifeline (itself an arrow) at a chosen height, and stay attached as the
lifeline moves.

## Behaviour

- While dragging an arrow endpoint near another arrow, that arrow reveals a row
  of **evenly-spaced snap points** along its line (~one every 24px, clamped to
  4–40 divisions so short lines still get a few and long ones don't explode).
  The endpoint snaps to the nearest division so connections line up neatly.
- Element anchors win: if the cursor is also near a shape's connection anchor,
  that pins as before. Arrow snapping only kicks in when no anchor is in range.
- The connection is **persistent and dynamic**: the endpoint stores the target
  arrow + a parametric position `t` (0 = the target's `from`, 1 = its `to`), and
  resolves its absolute position from the target's centreline every render — so
  it tracks the target as it moves, reshapes (straight / curved / angled), or
  its own endpoints move.
- A connected endpoint draws filled (like a pinned endpoint), not hollow.
- It applies both ways an arrow is created: **repositioning** an existing
  endpoint (live snap dots as you drag), and **drawing a new arrow** (the arrow
  tool, or a pencil-recognised line) — a fresh arrow's ends connect to a nearby
  line at commit, so you don't have to drop it and nudge it after.
- **Shift-drag the arrow HEAD forks a branch** (spec/09): holding Shift while
  grabbing a selected arrow's head handle leaves the arrow untouched and
  instead starts a NEW arrow whose tail is an `on-arrow` connection at ~70%
  along the trunk's line; the branch's head follows the drag and lands like
  any new arrow (anchor / arrow / free). One trunk can then point at several
  targets — a Y-fork instead of parallel near-duplicate arrows — and the
  branch inherits the trunk's stroke colour / weight / pattern so the fork
  reads as one connector. Repositioning (the plain drag) is unchanged.

## Model

`Endpoint` gains a third kind alongside `free` and `pinned`
(`packages/diagram/src/index.ts`):

```ts
| { kind: 'on-arrow'; arrowId: ElementId; t: number }
```

- `endpointPosition` resolves it via the target arrow's centreline
  (`arrowLabelAnchor` at `{ t, offset: 0 }`), recursing through the target's own
  endpoints with a depth guard so a pathological cycle can't loop forever.
- `arrowSnapPoints(arrow, elements)` and `snapToArrowPoint(cursor, elements,
threshold, excludeId)` (`geometry-snapping.ts`) compute the dots + the nearest
  connection; `snapToArrowPoint` skips the dragged arrow and any arrow already
  attached to it (no two-arrow cycle).
- Cascade rules mirror pinned: duplicating remaps the connection to the copied
  target when present (`factories.ts`); deleting a target arrow cascade-deletes
  the arrows attached to it (`arrowReferencesAny`).
- Reveal distance (perpendicular) shows the dots; a tighter threshold connects.
  Drag-snap lives in `apps/live/hooks/canvas/useEditorDrag.ts`.
- Telemetry (spec/22): `track('Element', 'Linked', 'ArrowPoint')`, once per drag.

## Out of scope (for now)

- Re-pinning a connection's `t` automatically when the target arrow is reshaped
  by adding/removing bends (it stays at the same parametric `t`, which is the
  intended "rides along the line" behaviour).
- Remapping an `on-arrow` connection onto the copy in the boxed-only
  duplicate-selection path (it stays attached to the original line).
