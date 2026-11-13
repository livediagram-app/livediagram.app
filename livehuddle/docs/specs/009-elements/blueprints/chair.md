# Chair: blueprint

Derived from [Chair](../chair.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`Dn`.

Scope, by file:

| File                                                        | Role                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/document/src/collab-shapes.ts`                    | `ChairFacing`, labels, guard, `CHAIR_SITTER_FACING` (the package's)      |
| `packages/avatar/src/seats.ts`                              | Seat geometry: grids, seats, `seatPoints`, `nearestSeat`, `seatFor`      |
| `packages/avatar/src/seat-claims.ts`                        | Taken seats, `seatOnArrival`, the tiebreak (`claimBeats`), `seatToYield` |
| `packages/avatar/src/hooks/useSeatYield.ts`                 | The later of two sitters on one seat stands up beside it                 |
| `packages/document/src/shape-geometry.ts`                   | `chairSeatFill`                                                          |
| `packages/document/src/shape-factory.ts`                    | 76x84, `chairFacing: DEFAULT_CHAIR_FACING`, `aspectLocked`, label bottom |
| `packages/document/src/colors.ts`                           | `behaviourSkin`: transparent box, outline and label ink per paper        |
| `packages/document/src/behaviour-skin.ts`                   | `ownColours`: the stamped `#94a3b8` / `#0f172a` pair reads as unset      |
| `packages/document/src/validate.ts`                         | Rejects an unknown `chairFacing`                                         |
| `packages/document/src/behaviour-shapes.ts`                 | `carriesSharedSettingsMenu('chair') === false`                           |
| `packages/document/src/svg-render-office-art.ts`            | The export chair                                                         |
| `packages/document/src/svg-render.ts`                       | Keeps the generic label for `chair` (bottom-aligned under the seat)      |
| `packages/api-schema/src/room-messages.ts`                  | `AvatarPresence.seatedOn`                                                |
| `apps/editor/components/canvas/BoxedElementView.tsx`        | Mounts `FurnitureView`; the ordinary label under it                      |
| `apps/editor/components/palette/tile-defs/room-tiles.tsx`   | `tools:chair` in **Seats** (`tileGroup: 'seating'`)                      |
| `apps/editor/components/canvas/useBoxedElementAnimation.ts` | Silhouette animations on the drawing                                     |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`         | `onWalkIntoChair` → `sitOn(seatFor)`; `chairSitters` from presence       |
| `packages/avatar/src/hooks/useAvatarWalk.ts`                | `sitOn`, `standUp`, seated guards, arrival hook, presence packet         |
| `apps/editor/hooks/canvas/useCanvasSurfaceGestures.ts`      | A click walks (standing you up); a seated peer is walked to, not pushed  |
| `packages/avatar/src/components/AvatarWalker.tsx`           | Seated pose (no Stand press, #560)                                       |
| `apps/editor/components/palette/CollabMenuSections.tsx`     | `ChairMenuSection` (facing tiles)                                        |
| `apps/editor/hooks/canvas/useDataShapeSetters.ts`           | `setChairFacingSelected` (`Element·Changed·Chair`)                       |

Desk and sofa (spec "Desk and sofa") add:

| File                                                      | Role                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/document/src/seating.ts`                        | `CHAIR_ART`, `DESK_ART`, `SOFA_ART`, `FURNITURE_ART`, `furnitureFrame` (a turn is `turnPiece`, [Turning furniture](furniture-facing.md)); re-exports the package's seat geometry (`isSeatingShape`, `DEFAULT_SEATING_FACING`, `facingView`, `seatPoints`, `nearestSeat`) |
| `packages/document/src/shape-factory.ts`                  | desk 120x112, sofa 152x85, facing, `aspectLocked`, label bottom                                                                                                                                                                                                          |
| `apps/editor/components/canvas/collab/FurnitureView.tsx`  | The canvas desk and sofa, occupied ring, sitter names                                                                                                                                                                                                                    |
| `apps/editor/hooks/canvas/useDataShapeSetters.ts`         | `setChairFacingSelected` for all three; quarter turns swap the box                                                                                                                                                                                                       |
| `apps/editor/components/palette/tile-defs/room-tiles.tsx` | `tools:desk`, `tools:sofa` after `tools:chair`                                                                                                                                                                                                                           |

## Domain and naming

| Term           | Identifier                                 | Meaning                                                 |
| -------------- | ------------------------------------------ | ------------------------------------------------------- |
| Chair          | shape kind `'chair'`                       | The element                                             |
| Facing         | `ChairFacing` (`'n' \| 'e' \| 's' \| 'w'`) | Where the back is; the seat points away from it         |
| Default facing | `DEFAULT_CHAIR_FACING` (`'n'`)             | Back at the top, sitter faces down the canvas           |
| Sitter facing  | `CHAIR_SITTER_FACING[facing]`              | `down`, `left`, `up`, `right`                           |
| Seat point     | `seatPoints(element)`                      | Where a sitter's feet snap, from the facing's view      |
| Seated         | `seatedOn: string \| null`                 | The chair id this character sits in                     |
| Seat claim     | `SeatClaim = { index, at, tie }`           | Which seat, when (epoch ms) and a random tiebreak       |
| Taken          | `takenSeats(element, peers)`               | The seat indices peers' presence holds                  |
| Sitter         | `ChairSitter = { name, color }`            | One occupant, from presence                             |
| Seating        | `SeatingKind`, `isSeatingShape`            | Chair, desk, sofa and meeting table: where one sits     |
| Furniture art  | `FurnitureArt` (`FURNITURE_ART[kind]`)     | A piece's three drawings (`FurnitureDrawing` each)      |
| View           | `facingView(facing)`                       | `n` front, `s` back, `e` side, `w` side mirrored        |
| Occupied       | `sitters.length > 0`                       | Derived per render, never stored                        |
| Seat fill      | `chairSeatFill(fillColor, stroke)`         | Own fill, or a 0.32 wash of the stroke when transparent |

Banned synonyms: "seat" for the element (the seat is a part of it), "occupancy" as a field,
"orientation", "rotation" for facing (rotation is the element's own).

## Behaviour and state

Per character: **standing** or **seated on `<chairId>`**. Held in `seatedRef` / `seatedOn` state
in `useAvatarWalk`; published on every avatar presence packet.

| From     | Event                                    | Guard            | To                                                    |
| -------- | ---------------------------------------- | ---------------- | ----------------------------------------------------- |
| standing | feet arrive on a chair (frontmost, D124) | a seat is free   | seated on the free nearest the click (keys: the feet) |
| standing | feet arrive on a chair (frontmost, D124) | every seat taken | standing, beside the piece                            |
| seated   | a peer's earlier claim on the same seat  | `claimBeats`     | standing, beside the seat                             |
| seated   | a peer's push                            |                  | unchanged (`shove` refuses)                           |
| seated   | arrival on another chair                 |                  | unchanged (D125)                                      |
| seated   | `walkTo` onto the piece it sits on       |                  | unchanged (`walkTo` returns)                          |
| seated   | any other `walkTo` (click, tap, a route) |                  | standing, walking there                               |
| seated   | any arrow key (`onSteer`)                |                  | standing                                              |
| seated   | leaving Avatar mode                      |                  | standing                                              |
| seated   | disconnect, tab change (peer's view)     |                  | gone with presence                                    |

1. **Sit.** `Canvas` passes `onWalkIntoChair(element, feet, aim)` for any `isSeatingShape` kind:
   `seatOnArrival(element, feet, peers, aim)` (`@livehuddle/avatar/seat-claims`) picks the seat nearest `aim` (the
   click-walk's destination, `destRef ?? targetRef`, which `sitsOnEntry` already holds inside the piece; absent for a
   walk in by keys, when it is the feet) that no peer's
   presence holds (`takenSeats`: a peer's `seat.index`, or for a packet without `seat` the seat nearest its feet),
   with its facing, the seat's own (a meeting table's) or `CHAIR_SITTER_FACING[seatingFacing(element)]`, then
   `sitOn(id, seat, seat.facing, seat.index)`. With every seat taken it answers `{ stopAt }`, a point `BESIDE_GAP`
   outside the piece's box nearest the feet (`besideBox`), and the canvas calls `stepAside(stopAt)`. A chair has one seat; a sofa two; a desk one (each view's `seats`). `sitOn` drops the walk target, arrival callback and held keys,
   snaps the feet, sets the facing, marks seated with a fresh claim (`at: Date.now()`, `tie: Math.random()`),
   records the chair as under the feet so standing still does not re-seat, and publishes at once.
2. **Seat point.** `seatPoints(element)` (`@livehuddle/avatar/seats`, so livehuddle seats without this product's
   document package): the facing's view (`facingView`) of the kind's seat grid (`SEAT_GRIDS`, which each
   `FurnitureDrawing` here spreads, so the seats and the drawing share one grid), each seat's `(u, v)` as
   fractions of the drawing as drawn, `u` mirrored for `w`: both renderers fit the view's grid whole and centred in
   the box (`preserveAspectRatio` meet), so a box of other proportions (a quarter turn written by an agent without
   swapping the box, an aspect unlocked) letterboxes it, and the seats follow the drawn rectangle (`drawnRect`). A chair's seats keep the old points: `n` `(0.5, 0.62)`,
   `s` `(0.5, 0.38)`, `e` `(0.38, 0.5)`, `w` `(0.62, 0.5)` (D123).
3. **Stand.** `standUp()` clears the seat and publishes at once; the character stays where the chair put it. Any
   movement calls it (#560): `onSteer` (an arrow key the field typing guard let through, `isTypingTarget`) and
   `walkTo(point)` unless `elementUnderFeet(elements, point)` is the seated piece, so a click, a tap and a route
   started for you stand you up and walk on in one gesture. Nothing else stands you up but `stepAside`, the yield
   and leaving the mode.
   `stepAside(point)` stands up too and moves the feet to `point` without walking.
   - **Yield.** `useSeatYield` runs `yieldFrom(elements, seatedOn, ownClaim, peers)` (`seatToYield` on the piece we sit on) whenever presence changes while seated: a
     peer on the same seat whose claim `claimBeats` ours (earlier `at`, then lower `tie`; a packet without `seat`
     counts as `at: 0`) sends us `stepAside` to `besideBox(element, seatPoint)`. Both machines compute the same winner.
   - **No push.** `shove` returns while seated; the pusher's click on a peer whose presence is seated walks up to
     them with no arrival push.
4. **Wave and react.** `playReaction` and `jump` do not read `seatedRef`; a seated character keeps
   both.
5. **Occupancy.** `Canvas.chairSitters` builds `Map<chairId, ChairSitter[]>` with
   `sittersByChair(self, peers.map(seatedPeer), seatsOnBoard(walkElements))` from our own `seatedOn` and
   `seatClaim` (named "You") and each `remoteAvatars[i].avatar` (`seatedOn`, `seat`, feet, `config.size`). Each
   sitter carries `seat` (the claim's index, or the seat nearest the feet for a packet without one, by `claimOf`)
   and `scale` (`avatarScale` of their size); each list is in seat order. `seatsOnBoard` looks a piece's seats up
   once per board and keeps them, so a packet costs a map lookup per seated peer.

Invariants:

- **I1:** no seating state is ever written to the document, the index or undo.
- **I2:** occupancy is a pure function of current presence.
- **I3:** one sitter per seat, settled from presence alone (`claimBeats`); nothing locks a chair.
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
// @livehuddle/avatar/seats (ChairFacing is its SeatFacing, ChairSitterFacing its AvatarFacing)
export type SeatGrid = { width: number; height: number; seats: readonly { u: number; v: number }[] };
export const SEAT_GRIDS: Record<'chair' | 'desk' | 'sofa', Record<'front' | 'back' | 'side', SeatGrid>>;
export const MEETING_TABLE_SEATS: { width: number; height: number; seats: readonly TableSeat[] };
export function seatPoints(el: Rect & { shape: SeatingKind; chairFacing?: SeatFacing }): Seat[];
export function nearestSeat(el: SeatedBox, from: Point): Seat;
export function seatFor(el: SeatedBox, from: Point): Seat & { facing: AvatarFacing };
// seating.ts
export type FurnitureDrawing = { width: number; height: number; parts: readonly FurniturePart[];
  seats: readonly { u: number; v: number }[]; ring: { cx: number; cy: number; rx: number; ry: number };
  ringUnder?: number };
export type FurnitureArt = { front: FurnitureDrawing; back: FurnitureDrawing; side: FurnitureDrawing };
export function facingView(facing: ChairFacing): { view: 'front' | 'back' | 'side'; mirrored: boolean };
export function furnitureFrame(art: FurnitureArt, facing: ChairFacing):
  { viewBox: string; transform: string; view: FurnitureDrawing };
export function chairSeatFill(fillColor: string | undefined, stroke: string): string;

// AvatarPresence (room-messages.ts)
seatedOn?: string | null;   // absent parses as standing
seat?: { index: number; at: number; tie: number } | null;   // absent: the seat nearest the feet, earliest

// apps/editor
export type ChairSitter = Sitter; // @livehuddle/avatar/chair-sitters: { name; color; seat?; scale? }
export function FurnitureView(props: { element: ShapeElement; stroke: string; sitters: ChairSitter[];
  animClass?: string }): JSX.Element | null;
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

| #   | Case                            | Handling                                            |
| --- | ------------------------------- | --------------------------------------------------- |
| E1  | Two characters in one chair     | Later claim stands beside it; an older client stays |
| E1a | Every seat of a piece taken     | Arrival stops beside the piece, standing            |
| E1b | Push at a seated character      | Not sent; ignored if it arrives anyway              |
| E2  | Sitter closes the laptop        | Presence expires; chair empties (I2)                |
| E3  | Chair deleted under a sitter    | Sitter stays seated until they stand or leave       |
| E4  | Chair rotated as an element     | Arrival uses the unrotated box (D124)               |
| E5  | Chair under a frontmost element | The frontmost element wins arrival                  |
| E6  | Touch device with no keys       | **Stand** press under the character [QF16]          |
| E7  | Unknown `chairFacing`           | Tab write rejected                                  |
| E8  | Seat ring and seat point        | Ring at 40/72 of the grid, feet at 0.62 (gap GF10)  |
| E9  | Unstyled chair on dark paper    | Canvas and export both draw `#64748b`               |
| E10 | Chair stored with stamped skin  | `ownColours` drops it; label ink follows the paper  |

## Security and trust

- `seatedOn` is presence from any role, like the rest of the `avatar` op; a peer can only claim a
  seat for its own character.
- A forged `seatedOn` draws a ring and a name on one chair; it writes nothing.

## Presentation and UX

- **Drawing:** `CHAIR_ART` in the furniture table, three views on a 64x72 grid from the room's camera
  (chair.md "Facing"): front (tall backrest behind the seat and its front edge), back (the backrest's
  back over the seat), side (the seat from above, the backrest a bar on its right); facing right
  mirrors the side (`translate(64 0) scale(-1 1)`), and nothing is rotated. Every view has its contact
  shadow under it. Faces toward the room (`role: 'face'`) are the panel shaded with the stroke at
  `FURNITURE_FACE_SHADE`. Canvas (`FurnitureView`) and export (`furnitureArt`) share it.
- **Seat fill:** `chairSeatFill`; a transparent or absent fill washes the stroke at 0.32.
- **Unstyled colours** (`behaviourSkin`, none stored): transparent box; light paper stroke
  `#94a3b8`, label `#0f172a`; dark paper stroke `#64748b`, label `#ffffff`. The export follows
  this, and so does the canvas: `FurnitureView` takes `defaultStrokeColor(element, surface)`.
- **Label:** under the chair (`textAlignY: 'bottom'`), on the canvas and in the export.
- **Palette:** tile `tools:chair` ("Add Chair") in the **Seats** category (the Meet band).
- **Occupied:** a 3 px ring (opacity 0.85) painted inside the drawing's frame (so a mirrored side
  mirrors it) before `parts[ringUnder]`: on the seat, under whatever stands nearer the camera (a
  backrest's back, the desk and its monitor, a sofa's arms). A one-seat drawing uses its own `ring`
  in the first sitter's colour; a drawing with several `seats` draws `seatRing(view, sitter.seat)` per
  sitter in their colour: centred on the seat point, `ry` 8, `rx` 20 narrowed to 0.45 of the gap to a
  seat on the same row. A sitter with no `seat` gets no ring there. Names in a pill ABOVE the piece
  [QF16], its bottom edge at `seatPillBottom(element, view, sitters)`: the highest
  `feet - (AVATAR_HEIGHT x scale + AVATAR_HEAD_CHROME)` among the sitters, less `SEAT_PILL_GAP` (3 px),
  never below the box's top. `AVATAR_HEAD_CHROME` (walk.ts, 24 px) is the highest of what `AvatarWalker`
  draws over a head (name chip 16, own status 22, Zz 24), so the pill clears both the sprite and its chip.
  The pill is `SeatPill` (FurnitureView.tsx): it reads `useGameOn(element.id)` (lib/table-games/table-game-scene.ts)
  and renders nothing while the piece shows a game (Ready, play or won), since the scoreboard names the players. The
  subscription is one `useSyncExternalStore` per occupied piece, notified only when a game starts or ends.
- **No `…`:** `carriesSharedSettingsMenu('chair')` is `false`.
- **Telemetry:** placing emits `Element·Added·Chair`; a facing change emits `Element·Changed·Chair`;
  sitting and standing emit nothing.
- **Menu:** accordion **Chair**, four tiles with arrows `↓ ← ↑ →` labelled Down, Left, Up, Right,
  hint "Which way somebody sitting here faces. Walk an Avatar-mode character into the chair to sit
  down."
- **Animations:** glow, pulse, trace and gradient ride the drawing (`lvd-anim-text-*`, and
  `lvd-anim-sticker-gradient` for gradient); motion animations move the element.
- **Seated pose:** `AvatarWalker` with `seated`. No **Stand** pill (#560): moving stands you up.

## Accessibility

- `FurnitureView` SVG: `role="img"`, `aria-label` "Empty chair" or "Chair, <names> sitting".
- Standing up has keyboard (arrows), pointer (click) and touch (tap) paths, each the same gesture as a walk.
- Silhouette animations respect the global reduced-motion rules of the animation system.

## Web experience

- **INP:** sitting is one state update; occupancy is a memoised map per presence change.
- **CLS:** the drawing and name pill are absolutely positioned inside the fixed box.

## Observability

No log, by design (Work Tracker #579). The editors keep no client logs (no `console.debug` in app code), and a sit
or a stand is already observable where it matters: each publishes the character's `seatedOn` and `seat` on its
presence packet at once ("tells the room at once which seat it sat on …", "frees the seat for the room at once …" in
`packages/avatar/src/hooks/useAvatarWalk.seats.test.tsx`), and every peer draws it. The `[chair] sit` and
`[chair] stand` fingerprints once proposed here are not built.

## Testing

| Rule                                          | Test                                                                 | File                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Four facings only                             | "accepts only the four facings"                                      | `packages/document/src/collab-shapes.test.ts`                          |
| Seat on the seat at every facing              | "seats a chair sitter on the seat, never …"                          | `packages/document/src/seating.test.ts`                                |
| A drawing per facing, never rotated           | "shows a drawing per facing, never a rotation …"                     | `packages/document/src/seating.test.ts`                                |
| Every view stands on its shadow               | "keeps every piece standing …"                                       | `packages/document/src/seating.test.ts`                                |
| Side view fits the swapped box                | "gives a side view the footprint of a quarter turn"                  | `packages/document/src/seating.test.ts`                                |
| Sitter faces the way the menu says            | "turns the sitter the way the seat points"                           | `packages/document/src/collab-shapes.test.ts`                          |
| No shared `…`                                 | "is on every Behaviours card except the chair …"                     | `packages/document/src/collab-shapes.test.ts`                          |
| Export draws the table chair, washed seat     | "the export draws the table chair …"                                 | `livediagram/packages/document/src/shape-geometry.test.ts`             |
| Export draws its facing, mirrors right        | "draws the export for its facing, never rotated …"                   | `livediagram/packages/document/src/shape-geometry.test.ts`             |
| Canvas draws the same table, upright          | "FurnitureView draws the table chair, upright …"                     | `livediagram/apps/editor/components/canvas/shape-svg-overlay.test.tsx` |
| Export draws a body                           | "draws more than a box and a label"                                  | `packages/document/src/export-consistency.test.ts`                     |
| Frontmost element under the feet              | `elementUnderFeet` block                                             | `apps/editor/lib/avatar-walk.test.ts`                                  |
| Sit once on arrival                           | "asks to sit once when the feet arrive …", "asks again only after …" | `packages/avatar/src/hooks/useAvatarWalk.arrival.test.tsx`             |
| A click, tap or arrow stands up and walks     | "a walk while seated stands up …", "an arrow key …"                  | `packages/avatar/src/hooks/useAvatarWalk.seats.test.tsx`               |
| A seated tap reaches the walk (gesture)       | "stands you up and walks you to the tapped spot"                     | `apps/editor/hooks/canvas/useCanvasSurfaceGestures.seated.test.tsx`    |
| Typing in a field never stands you up         | "keys typed into a field …"                                          | `packages/avatar/src/hooks/useAvatarWalk.seats.test.tsx`               |
| Clicking your own seat keeps you in it        | "a walk onto the piece you sit on …"                                 | `packages/avatar/src/hooks/useAvatarWalk.seats.test.tsx`               |
| Leaving the mode vacates the chair            | "vacates the chair, stands still and tells peers"                    | `apps/editor/hooks/canvas/useAvatarWalk.test.tsx`                      |
| Re-entering the mode starts unseated          | "comes back unseated"                                                | `apps/editor/hooks/canvas/useAvatarWalk.test.tsx`                      |
| Created with no stored colour; stamp is unset | "are created with no stored colour", "treat the …"                   | `packages/document/src/behaviour-skin.test.ts`                         |
| Occupancy from presence only (I1, I2)         | "lists our own character and every seated peer …"                    | `packages/avatar/src/chair-sitters.test.ts`                            |
| The exact seat ringed; pill clears the head   | "rings each sofa cushion …", "lifts the name pill clear …"           | `apps/editor/components/canvas/collab/FurnitureView.test.tsx`          |
| No name pill while a game shows its players   | "hides the name pill while the table shows a game …"                 | `apps/editor/components/canvas/collab/FurnitureView.test.tsx`          |
| Label survives export                         | "prints a chair label under the seat"                                | `packages/document/src/svg-render-fidelity.test.ts`                    |
| Unknown facing rejected                       | "rejects an off-vocabulary chair facing"                             | `packages/document/src/collab-shapes.test.ts`                          |
| Desk faces the computer; sofa the reader      | "a new desk faces its sitter at the computer …"                      | `packages/document/src/seating.test.ts`                                |
| Sofa has two seats; nearest seat taken        | `seatPoints`, `nearestSeat` blocks                                   | `packages/avatar/src/seats.test.ts`                                    |
| Taken seat skipped; full piece stops beside   | `seatOnArrival` block                                                | `packages/avatar/src/seat-claims.test.ts`                              |
| Tiebreak: earlier, then lower tie; old client | `claimBeats`, `seatToYield` blocks                                   | `packages/avatar/src/seat-claims.test.ts`                              |
| Seated ignores a push; sit and stand publish  | "a seated character …"                                               | `packages/avatar/src/hooks/useAvatarWalk.seats.test.tsx`               |
| Quarter turn swaps a desk or sofa box         | "swaps a desk or sofa box about its centre …"                        | `packages/document/src/seating.test.ts`                                |

## Constants and configuration

| Name                       | Value                                                                                   | Provenance / safe range                       |
| -------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| `SHAPE_DEFAULT_SIZE.chair` | `{ width: 76, height: 84 }`                                                             | Human scale beside a 40 px character (D126)   |
| `SHAPE_DEFAULT_SIZE.desk`  | `{ width: 120, height: 112 }`                                                           | `DESK_ART` grid (D203)                        |
| `SHAPE_DEFAULT_SIZE.sofa`  | `{ width: 152, height: 85 }`                                                            | `SOFA_ART` aspect (D203)                      |
| `DESK_ART` seats           | back `(0.5, 0.68)`, front `(0.5, 0.26)`, side `(0.62, 0.52)`                            | On the desk's chair in each view              |
| `SOFA_ART` seats           | `u` 44/136 and 92/136: back `v` 0.27, front 0.58; side `u` 33/76, `v` 44/136 and 88/136 | One per cushion (D204)                        |
| `CHAIR_ART` seats          | front `(0.5, 0.62)`, back `(0.5, 0.38)`, side `(0.38, 0.5)`                             | Away from the backrest (D123)                 |
| `FURNITURE_FACE_SHADE`     | `0.22`                                                                                  | Stroke over the seat fill; 0.15 to 0.3 (D206) |
| `DEFAULT_CHAIR_FACING`     | `'n'`                                                                                   | Sitter faces the reader                       |
| `BESIDE_GAP`               | `12` canvas px                                                                          | Clear of the box, inside a click's reach      |
| `CHAIR_ART` grid           | `64 x 72` in every view                                                                 | Square enough to turn in place                |
| Desk / sofa grids          | front and back `120 x 112` / `136 x 76`; side swapped                                   | The side fills the swapped box (D207)         |
| Seat wash alpha            | `0.32` (`chairSeatFill`)                                                                | Visible on light and dark themes              |
| Unstyled stroke / text     | light `'#94a3b8'` / `'#0f172a'`; dark `'#64748b'` / `'#ffffff'`                         | `behaviourSkin`; not stored                   |
