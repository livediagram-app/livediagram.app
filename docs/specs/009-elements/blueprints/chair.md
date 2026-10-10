# Chair: blueprint

Derived from [Chair](../chair.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`Dn`.

Scope, by file:

| File                                                      | Role                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/document/src/collab-shapes.ts`                  | `ChairFacing`, labels, guard, `CHAIR_SITTER_FACING`, `chairSeatPoint`    |
| `packages/document/src/shape-geometry.ts`                 | `CHAIR_GEOMETRY`, `CHAIR_FACING_ROTATION`, `chairSeatFill`               |
| `packages/document/src/shape-factory.ts`                  | 76x84, `chairFacing: DEFAULT_CHAIR_FACING`, `aspectLocked`, label bottom |
| `packages/document/src/colors.ts`                         | `behaviourSkin`: transparent box, outline and label ink per paper        |
| `packages/document/src/behaviour-skin.ts`                 | `ownColours`: the stamped `#94a3b8` / `#0f172a` pair reads as unset      |
| `packages/document/src/validate.ts`                       | Rejects an unknown `chairFacing`                                         |
| `packages/document/src/behaviour-shapes.ts`               | `carriesSharedSettingsMenu('chair') === false`                           |
| `packages/document/src/svg-render-faces.ts`               | The export chair                                                         |
| `packages/document/src/svg-render.ts`                     | Keeps the generic label for `chair` (bottom-aligned under the seat)      |
| `packages/api-schema/src/room-messages.ts`                | `AvatarPresence.seatedOn`                                                |
| `apps/live/components/canvas/collab/ChairView.tsx`        | The canvas chair, occupied ring, sitter names                            |
| `apps/live/components/canvas/BoxedElementView.tsx`        | Mounts `ChairView`; the ordinary label under it                          |
| `apps/live/components/palette/palette-tile-defs.tsx`      | `tools:chair` in the **Navigate** accordion (`tileGroup: 'move'`)        |
| `apps/live/components/canvas/useBoxedElementAnimation.ts` | Silhouette animations on the drawing                                     |
| `apps/live/components/canvas/Canvas.tsx`                  | `onWalkIntoChair` → `sitOn`; `chairSitters` from presence                |
| `apps/live/hooks/canvas/useAvatarWalk.ts`                 | `sitOn`, `standUp`, seated guards, arrival hook, presence packet         |
| `apps/live/hooks/canvas/useCanvasSurfaceGestures.ts`      | Double-click stands up                                                   |
| `apps/live/components/canvas/AvatarWalker.tsx`            | Seated pose and the **Stand** press                                      |
| `apps/live/components/palette/CollabMenuSections.tsx`     | `ChairMenuSection` (facing tiles)                                        |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`           | `setChairFacingSelected` (`Element·Changed·Chair`)                       |

## Domain and naming

| Term           | Identifier                                 | Meaning                                                 |
| -------------- | ------------------------------------------ | ------------------------------------------------------- |
| Chair          | shape kind `'chair'`                       | The element                                             |
| Facing         | `ChairFacing` (`'n' \| 'e' \| 's' \| 'w'`) | Where the back is; the seat points away from it         |
| Default facing | `DEFAULT_CHAIR_FACING` (`'n'`)             | Back at the top, sitter faces down the canvas           |
| Sitter facing  | `CHAIR_SITTER_FACING[facing]`              | `down`, `left`, `up`, `right`                           |
| Seat point     | `chairSeatPoint(box, facing)`              | Where a sitter's feet snap                              |
| Seated         | `seatedOn: string \| null`                 | The chair id this character sits in                     |
| Sitter         | `ChairSitter = { name, color }`            | One occupant, from presence                             |
| Occupied       | `sitters.length > 0`                       | Derived per render, never stored                        |
| Seat fill      | `chairSeatFill(fillColor, stroke)`         | Own fill, or a 0.32 wash of the stroke when transparent |

Banned synonyms: "seat" for the element (the seat is a part of it), "occupancy" as a field,
"orientation", "rotation" for facing (rotation is the element's own).

## Behaviour and state

Per character: **standing** or **seated on `<chairId>`**. Held in `seatedRef` / `seatedOn` state
in `useAvatarWalk`; published on every avatar presence packet.

| From     | Event                                    | Guard              | To                           |
| -------- | ---------------------------------------- | ------------------ | ---------------------------- |
| standing | feet arrive on a chair (frontmost, D124) | Avatar mode active | seated on it                 |
| seated   | arrival on another chair                 |                    | unchanged (D125)             |
| seated   | canvas click                             |                    | unchanged (`walkTo` refuses) |
| seated   | any arrow key (`onSteer`)                |                    | standing                     |
| seated   | canvas double-click (`e.detail >= 2`)    |                    | standing                     |
| seated   | **Stand** press                          | own character only | standing                     |
| seated   | leaving Avatar mode                      |                    | standing                     |
| seated   | disconnect, tab change (peer's view)     |                    | gone with presence           |

1. **Sit.** `Canvas` passes `onWalkIntoChair(element)`: facing `= element.chairFacing ??
DEFAULT_CHAIR_FACING`, then `sitOn(id, chairSeatPoint(element, facing),
CHAIR_SITTER_FACING[facing])`. `sitOn` drops the walk target, arrival callback and held keys,
   snaps the feet, sets the facing, marks seated, and records the chair as under the feet so
   standing still does not re-seat.
2. **Seat point.** Centre `(cx, cy)`, offset `CHAIR_SEAT_DROP - 0.5 = 0.12` of the box away from
   the back: `n` → `(cx, y + 0.62h)`, `e` → `(cx - 0.12w, cy)`, `s` → `(cx, cy - 0.12h)`, `w` →
   `(cx + 0.12w, cy)` (D123).
3. **Stand.** `standUp()` clears the seat; the character stays where the chair put it.
4. **Wave and react.** `playReaction` and `jump` do not read `seatedRef`; a seated character keeps
   both.
5. **Occupancy.** `Canvas.chairSitters` builds `Map<chairId, ChairSitter[]>` from our own
   `seatedOn` (named "You") and each `remoteAvatars[i].avatar.seatedOn`.

Invariants:

- **I1:** no seating state is ever written to the document, D1 or undo.
- **I2:** occupancy is a pure function of current presence.
- **I3:** two or more sitters are allowed; nothing locks a chair.
- **I4:** sitting fires once per arrival, never per frame.

## Interfaces and contracts

```ts
// ShapeElement
chairFacing?: ChairFacing;

export type ChairFacing = 'n' | 'e' | 's' | 'w';
export const CHAIR_FACINGS: readonly ChairFacing[];
export const DEFAULT_CHAIR_FACING: ChairFacing;
export const CHAIR_FACING_LABELS: Record<ChairFacing, string>;
export function isChairFacing(value: unknown): value is ChairFacing;
export type ChairSitterFacing = 'down' | 'left' | 'up' | 'right';
export const CHAIR_SITTER_FACING: Record<ChairFacing, ChairSitterFacing>;
export const CHAIR_SEAT_DROP = 0.62;
export function chairSeatPoint(box: { x: number; y: number; width: number; height: number },
  facing?: ChairFacing): { x: number; y: number };
export const CHAIR_FACING_ROTATION: Record<ChairFacing, number>;
export function chairSeatFill(fillColor: string | undefined, stroke: string): string;

// AvatarPresence (room-messages.ts)
seatedOn?: string | null;   // absent parses as standing

// apps/live
export type ChairSitter = { name: string; color: string };
export function ChairView(props: { element: ShapeElement; sitters: ChairSitter[];
  animClass?: string }): JSX.Element;
```

| Input                         | Handling                           |
| ----------------------------- | ---------------------------------- |
| `chairFacing` absent          | Valid; `'n'`                       |
| `chairFacing` not in the four | `isValidElement` returns `false`   |
| `seatedOn` absent or `null`   | Standing                           |
| `seatedOn` names no chair     | Map entry never rendered; harmless |

## Data and persistence

- **Persisted:** `chairFacing`, `label`, colours.
- **Presence only:** `seatedOn`, relayed with the `avatar` op, never logged, never replayed.
- **Undo:** facing changes are ordinary commits.
- **Export:** the empty chair at its facing, with its label under the seat; never a sitter.

## Errors and edge cases

| #   | Case                            | Handling                                              |
| --- | ------------------------------- | ----------------------------------------------------- |
| E1  | Two characters in one chair     | Both render; ring in the first sitter's colour (D122) |
| E2  | Sitter closes the laptop        | Presence expires; chair empties (I2)                  |
| E3  | Chair deleted under a sitter    | Sitter stays seated until they stand or leave         |
| E4  | Chair rotated as an element     | Arrival uses the unrotated box (D124)                 |
| E5  | Chair under a frontmost element | The frontmost element wins arrival                    |
| E6  | Touch device with no keys       | **Stand** press under the character [QF16]            |
| E7  | Unknown `chairFacing`           | Tab write rejected                                    |
| E8  | Seat ring and seat point        | Ring at 40/72 of the grid, feet at 0.62 (gap GF10)    |
| E9  | Unstyled chair on dark paper    | Canvas draws `#94a3b8`, export `#64748b` (gap GF15)   |
| E10 | Chair stored with stamped skin  | `ownColours` drops it; label ink follows the paper    |

## Security and trust

- `seatedOn` is presence from any role, like the rest of the `avatar` op; a peer can only claim a
  seat for its own character.
- A forged `seatedOn` draws a ring and a name on one chair; it writes nothing.

## Presentation and UX

- **Drawing:** `CHAIR_GEOMETRY` on a 64x72 grid, drawn facing `n` and turned whole by
  `CHAIR_FACING_ROTATION` (0, 90, 180, 270 degrees): contact shadow, tall backrest, slat, seat
  slab, two legs and a stretcher. Canvas (`ChairView`) and export (`svgBehaviourFace`) share it.
- **Seat fill:** `chairSeatFill`; a transparent or absent fill washes the stroke at 0.32.
- **Unstyled colours** (`behaviourSkin`, none stored): transparent box; light paper stroke
  `#94a3b8`, label `#0f172a`; dark paper stroke `#64748b`, label `#ffffff`. The export follows
  this; `ChairView` reads `element.strokeColor ?? '#94a3b8'` on either paper (GF15).
- **Label:** under the chair (`textAlignY: 'bottom'`), on the canvas and in the export.
- **Palette:** tile `tools:chair` ("Add Chair") in the **Navigate** group of Collaborate.
- **Occupied:** a 3 px ring (`CHAIR_GEOMETRY.ring`, opacity 0.85) in the first sitter's colour;
  names in a pill ABOVE the chair, outside the rotated SVG so they never turn [QF16].
- **No `…`:** `carriesSharedSettingsMenu('chair')` is `false`.
- **Telemetry:** placing emits `Element·Added·Chair`; a facing change emits `Element·Changed·Chair`;
  sitting and standing emit nothing.
- **Menu:** accordion **Chair**, four tiles with arrows `↓ ← ↑ →` labelled Down, Left, Up, Right,
  hint "Which way somebody sitting here faces. Walk an Avatar-mode character into the chair to sit
  down."
- **Animations:** glow, pulse, trace and gradient ride the drawing (`lvd-anim-text-*`, and
  `lvd-anim-sticker-gradient` for gradient); motion animations move the element.
- **Seated pose:** `AvatarWalker` with `seated`; the **Stand** pill (10 px, slate) under your own
  character only.

## Accessibility

- `ChairView` SVG: `role="img"`, `aria-label` "Empty chair" or "Chair, <names> sitting".
- **Stand** is a native `<button>` with visible text.
- Standing up has keyboard (arrows), pointer (double-click) and touch (Stand) paths.
- Silhouette animations respect the global reduced-motion rules of the animation system.

## Web experience

- **INP:** sitting is one state update; occupancy is a memoised map per presence change.
- **CLS:** the drawing and name pill are absolutely positioned inside the fixed box.

## Observability

No log exists today. Proposed fingerprints (gap, see the report):

| #   | Where      | Level           | Fingerprint                       |
| --- | ---------- | --------------- | --------------------------------- |
| O1  | `sitOn`    | `console.debug` | `[chair] sit id=<id> facing=<f>`  |
| O2  | stand path | `console.debug` | `[chair] stand id=<id> via=<via>` |

`<via>` is `key`, `dblclick`, `press` or `leave`.

## Testing

| Rule                                           | Test                                                 | File                                                     |
| ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Four facings only                              | "accepts only the four facings"                      | `packages/document/src/collab-shapes.test.ts`            |
| Seat below centre; turns with facing           | "seats the sitter below the box centre …", "moves …" | `packages/document/src/collab-shapes.test.ts`            |
| Sitter faces the way the menu says             | "turns the sitter the way the seat points"           | `packages/document/src/collab-shapes.test.ts`            |
| No shared `…`                                  | "is on every Behaviours card except the chair …"     | `packages/document/src/collab-shapes.test.ts`            |
| Export draws the table chair, washed seat      | "the export draws the table chair …"                 | `packages/document/src/shape-geometry.test.ts`           |
| Export turns for its facing                    | "turns the export for its facing …"                  | `packages/document/src/shape-geometry.test.ts`           |
| Canvas draws the same table                    | "ChairView draws the table chair"                    | `apps/live/components/canvas/shape-svg-overlay.test.tsx` |
| Export draws a body                            | "draws more than a box and a label"                  | `packages/document/src/export-consistency.test.ts`       |
| Frontmost element under the feet               | `elementUnderFeet` block                             | `apps/live/lib/avatar-walk.test.ts`                      |
| Sit once on arrival; seated ignores walks (I4) | none                                                 | (gap)                                                    |
| Arrow, double-click, Stand all stand up        | none                                                 | (gap)                                                    |
| Leaving the mode vacates the chair             | "vacates the chair, stands still and tells peers"    | `apps/live/hooks/canvas/useAvatarWalk.test.tsx`          |
| Re-entering the mode starts unseated           | "comes back unseated"                                | `apps/live/hooks/canvas/useAvatarWalk.test.tsx`          |
| Created with no stored colour; stamp is unset  | "are created with no stored colour", "treat the …"   | `packages/document/src/behaviour-skin.test.ts`           |
| Occupancy from presence only (I1, I2)          | none                                                 | (gap)                                                    |
| Label survives export                          | "prints a chair label under the seat"                | `packages/document/src/svg-render-fidelity.test.ts`      |
| Unknown facing rejected                        | "rejects an off-vocabulary chair facing"             | `packages/document/src/collab-shapes.test.ts`            |
| Canvas chair follows the paper                 | none                                                 | (gap GF15)                                               |

## Constants and configuration

| Name                       | Value                                                           | Provenance / safe range                     |
| -------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| `SHAPE_DEFAULT_SIZE.chair` | `{ width: 76, height: 84 }`                                     | Human scale beside a 40 px character (D126) |
| `DEFAULT_CHAIR_FACING`     | `'n'`                                                           | Sitter faces the reader                     |
| `CHAIR_SEAT_DROP`          | `0.62`                                                          | Fraction from the back; 0.55 to 0.7 (D123)  |
| `CHAIR_FACING_ROTATION`    | `{ n: 0, e: 90, s: 180, w: 270 }`                               | Degrees; fixed by the four facings          |
| `CHAIR_GEOMETRY.viewBox`   | `'0 0 64 72'`                                                   | Drawing grid                                |
| `CHAIR_GEOMETRY.ring`      | `{ cx: 32, cy: 40, rx: 24, ry: 10 }`                            | Occupied ring on the seat (see GF10)        |
| Seat wash alpha            | `0.32` (`chairSeatFill`)                                        | Visible on light and dark themes            |
| Unstyled stroke / text     | light `'#94a3b8'` / `'#0f172a'`; dark `'#64748b'` / `'#ffffff'` | `behaviourSkin`; not stored                 |
