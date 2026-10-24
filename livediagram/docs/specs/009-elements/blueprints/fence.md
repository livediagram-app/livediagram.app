# Fence: blueprint

Derived from [Fence](../fence.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`Dn`.

Scope, by file:

| File                                                      | Role                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/document/src/shape-kind.ts`                     | `'fence'` in `ShapeKind`                                              |
| `packages/document/src/fence.ts`                          | `fenceRun`, `fencePostCentres`, `fenceParts`, `fenceLine`, constants  |
| `packages/document/src/shape-factory.ts`                  | `SHAPE_DEFAULT_SIZE.fence` 240x24                                     |
| `packages/document/src/colors.ts`                         | `behaviourSkin`: transparent box, `FENCE_WOOD` stroke; self-painting  |
| `packages/document/src/data-shapes.ts`                    | `isSelfDrawingShape('fence')`: no label, no text align                |
| `packages/document/src/element-types.ts`                  | `UNTYPED_SHAPES`: no caret                                            |
| `packages/document/src/behaviour-shapes.ts`               | In `BEHAVIOUR_SHAPES`; `carriesSharedSettingsMenu('fence') === false` |
| `packages/document/src/validate.ts`                       | Accepts the kind                                                      |
| `packages/document/src/svg-render-faces.ts`               | `fenceArt`: the export fence                                          |
| `packages/document/src/animation-membership.ts`           | Wordless                                                              |
| `apps/editor/components/canvas/collab/FenceView.tsx`        | The canvas fence                                                      |
| `apps/editor/components/canvas/BoxedElementView.tsx`        | Mounts `FenceView` with the resolved stroke                           |
| `apps/editor/components/canvas/shape-svg-overlay.tsx`       | Not an SVG-overlay shape (box path, transparent)                      |
| `apps/editor/components/canvas/useBoxedElementAnimation.ts` | Silhouette animations on the drawing                                  |
| `apps/editor/lib/avatar-fence.ts`                           | `fenceSegments`, `fenceRefuses`, `fenceStep`, `FENCE_REACH`           |
| `apps/editor/lib/avatar-walk.ts`                            | `elementUnderFeet` skips fences                                       |
| `apps/editor/hooks/canvas/useAvatarWalk.ts`                 | Memoised segments; every walk step goes through `fenceStep`           |
| `apps/editor/components/palette/palette-tile-defs.tsx`      | `tools:fence` in **Navigate** (`tileGroup: 'move'`)                   |
| `apps/editor/components/palette/palette-icons.tsx`          | `FenceIcon`                                                           |
| `packages/api-schema/src/telemetry-schema.ts`             | `Fence` element type token                                            |

## Domain and naming

| Term       | Identifier                  | Meaning                                            |
| ---------- | --------------------------- | -------------------------------------------------- |
| Fence      | shape kind `'fence'`        | The element                                        |
| Run        | `fenceRun(box)`             | Direction (`horizontal`), `length` and `thickness` |
| Post       | `FencePart` `role: 'post'`  | An upright, at each end and at even spacing        |
| Rail       | `FencePart` `role: 'rail'`  | One of two horizontal bars, full length            |
| Fence line | `fenceLine(box)`            | The blocking centre line, end to end, rotated      |
| Reach      | `FENCE_REACH`               | How close feet may come to a fence line            |
| Refuse     | `fenceRefuses(from, to, f)` | One fence will not allow a step                    |
| Slide      | `fenceStep` `blocked: true` | The refused step's component along the fence       |

Banned synonyms: "wall", "barrier" as an identifier, "collider", "obstacle".

## Behaviour and state

A fence has no state of its own. Per walking character, every frame of `useAvatarWalk`:

1. `wanted` = the arrow-key step or `stepTowards` toward the target.
2. `fenceStep(from, wanted, fences)`:
   - no fences, or no fence refuses → `{ pos: wanted, blocked: false }`;
   - else, the step projected onto the first refusing fence's direction, if that is at least
     `FENCE_STALL` long and no fence refuses it → `{ pos: slid, blocked: true }`;
   - else the furthest point along the step no fence refuses, by `FENCE_APPROACH_STEPS` halvings
     → `{ pos, blocked: true }`.
3. Blocked, click-walking, and moved less than `FENCE_STALL` → target and arrival callback dropped
   (the walk stops; a shove's `onArrive` never fires).
4. Arrival (`step.arrived`) counts only for an unblocked step.

`fenceRefuses(from, to, fence)`:

- `from` at or beyond `FENCE_REACH` from the fence line → refused iff the step segment comes
  within `FENCE_REACH` of it (`segmentDistance`), so no step tunnels through and gaps narrower than
  `2 * FENCE_REACH` are sealed.
- `from` inside the reach → refused iff the step crosses the line or ends nearer to it.

Invariants:

- **I1:** no blocking state is written to the document, the room, the index or undo.
- **I2:** a character outside every fence's reach never ends a frame inside one.
- **I3:** a character inside a fence's reach can always move away from it.
- **I4:** teleports (portal), seating snaps and spawns do not pass through `fenceStep`.

## Interfaces and contracts

```ts
// packages/document/src/fence.ts
export type FencePoint = { x: number; y: number };
export const FENCE_DEFAULT_SIZE = { width: 240, height: 24 };
export const FENCE_POST_SPACING = 40;
export const FENCE_POST_WIDTH = 0.5;
export const FENCE_RAIL_HEIGHT = 0.16;
export const FENCE_RAIL_TOPS = [0.26, 0.58] as const;
export const FENCE_RAIL_OPACITY = 0.78;
export const FENCE_WOOD = { light: '#8a5a33', dark: '#c08a5b' } as const;
export function fenceRun(box: { width: number; height: number }): {
  horizontal: boolean;
  length: number;
  thickness: number;
};
export function fencePostCentres(length: number, thickness: number): number[];
export type FencePart = {
  role: 'post' | 'rail';
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
};
export function fenceParts(width: number, height: number): FencePart[];
export function fenceLine(box: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): { a: FencePoint; b: FencePoint };

// apps/editor/lib/avatar-fence.ts
export const FENCE_REACH = 12;
export const FENCE_STALL = 0.25;
export type FenceSegment = { a: FencePoint; b: FencePoint };
export function fenceSegments(elements: readonly Element[]): FenceSegment[];
export function pointSegmentDistance(p: FencePoint, s: FenceSegment): number;
export function segmentsIntersect(p: FenceSegment, q: FenceSegment): boolean;
export function segmentDistance(p: FenceSegment, q: FenceSegment): number;
export function fenceRefuses(
  from: FencePoint,
  to: FencePoint,
  fence: FenceSegment,
  reach?: number,
): boolean;
export function fenceStep(
  from: FencePoint,
  to: FencePoint,
  fences: readonly FenceSegment[],
  reach?: number,
): { pos: FencePoint; blocked: boolean };
```

| Input                          | Handling                                           |
| ------------------------------ | -------------------------------------------------- |
| `width >= height`              | Horizontal run                                     |
| `width < height`               | Vertical run                                       |
| Run shorter than its thickness | One post at the middle                             |
| Zero-length fence line         | Blocks a disc of `FENCE_REACH`; no slide direction |
| `rotation` absent              | 0                                                  |

## Data and persistence

- **Persisted:** the ordinary boxed fields (`x`, `y`, `width`, `height`, `rotation`, `strokeColor`,
  `opacity`, `locked`, `layerId`). No fence-specific field.
- **Never persisted:** fence segments, blocking, slides (I1).
- **Export:** rails then posts in the stroke colour, rotated with the element.

## Errors and edge cases

| #   | Case                                 | Handling                                                 |
| --- | ------------------------------------ | -------------------------------------------------------- |
| E1  | Fence dropped on a character         | Character may step away, never across (I3)               |
| E2  | Gap between fence ends `< 2 * reach` | Sealed                                                   |
| E3  | Diagonal walk into a fence           | Slides along it                                          |
| E4  | Click-walk target behind a fence     | Slides toward the target's foot, then stops on stall     |
| E5  | Two fences meeting at a corner       | Lines cross or touch; corner sealed                      |
| E6  | Portal on the far side               | Teleport ignores fences (I4)                             |
| E7  | Character spawns inside an enclosure | Stays inside until a portal (spec)                       |
| E8  | Peer on an older build               | Their own client does not block them (trust model, D199) |
| E9  | Fence deleted mid-walk               | Segments recompute on the next `elements` change         |
| E10 | Shove into a fence                   | The shove's walk is refused like any other               |

## Security and trust

- Blocking is enforced by each owner's client for their own character, the Avatar mode trust
  model. A modified client can walk through fences; the only effect is a character drawn somewhere
  the author fenced off, which writes nothing (D199).
- Fences are document elements: only an Editor can add, change or delete them.

## Performance and limits

- `fenceSegments` runs once per `elements` change (`useMemo`), O(n).
- Per frame: `fenceStep` is O(f) for an unblocked step, O(f) more for a slide, and
  `O(f * FENCE_APPROACH_STEPS)` for an approach, with f the number of fences.
- Budget: a worst case of 2000 fences stays under 4 ms per frame on CI hardware (test below);
  realistic boards have under 50.

## Presentation and UX

- **Drawing:** `fenceParts`: two rails (`FENCE_RAIL_TOPS`, `FENCE_RAIL_HEIGHT` of the thickness,
  full length, opacity `FENCE_RAIL_OPACITY`), then posts (`FENCE_POST_WIDTH` of the thickness, full
  thickness tall, `rx` 0.2 of their width) at `fencePostCentres`, all filled with the stroke.
- **Unstyled colours:** transparent box; stroke `FENCE_WOOD.light` / `FENCE_WOOD.dark` by paper.
- **No label, no caret, no `…`, no text alignment, no markers.**
- **Palette:** tile `tools:fence` ("Add Fence", caption "Fence", blurb "A barrier Avatars cannot
  walk through"), in **Navigate** after the sofa.
- **Animations:** glow, pulse, trace and gradient ride the drawing, as for the chair.
- **Telemetry:** placing emits `Element·Added·Fence`; blocking emits nothing.

## Accessibility

- `FenceView` SVG: `role="img"`, `aria-label` "Fence".
- The element wrapper keeps its `elementAriaLabel` name.

## Web experience

- **INP:** blocking adds O(f) arithmetic per animation frame, no DOM reads.
- **CLS:** the drawing fills its fixed box.

## Observability

No log exists today. Proposed fingerprint (gap): `console.debug('[fence] stall')` when a
click-walk stops against a fence.

## Testing

| Rule                                        | Test                                             | File                                            |
| ------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| Run follows the longer side                 | "runs along the longer side, across when square" | `packages/document/src/fence.test.ts`           |
| End posts inset; even spacing               | `fencePostCentres` block                         | `packages/document/src/fence.test.ts`           |
| Rails full length; corner posts coincide    | `fenceParts` block                               | `packages/document/src/fence.test.ts`           |
| Fence line, rotated                         | `fenceLine` block                                | `packages/document/src/fence.test.ts`           |
| Refused from either side; open past the end | `fenceRefuses` block                             | `apps/editor/lib/avatar-fence.test.ts`            |
| Escape but not cross from inside (I3)       | "lets a character inside the reach step away …"  | `apps/editor/lib/avatar-fence.test.ts`            |
| No tunnelling (I2)                          | "cannot tunnel through with one long step"       | `apps/editor/lib/avatar-fence.test.ts`            |
| Slide                                       | "slides along a fence walked into at an angle"   | `apps/editor/lib/avatar-fence.test.ts`            |
| Enclosure keeps people out, outside open    | "walks all the way round the outside …"          | `apps/editor/lib/avatar-fence.test.ts`            |
| Narrow gaps sealed, wide gaps open          | "seals a gap …", "leaves a gap …"                | `apps/editor/lib/avatar-fence.test.ts`            |
| Worst-case budget                           | "keeps a frame within budget …"                  | `apps/editor/lib/avatar-fence.test.ts`            |
| Self-drawing (no label)                     | "claims exactly the kinds its members claim …"   | `packages/document/src/data-shapes.test.ts`     |
| Walk loop stops a click-walk at a fence     | "stops a click-walk at a fence"                  | `apps/editor/hooks/canvas/useAvatarWalk.test.tsx` |

## Constants and configuration

| Name                   | Value                 | Provenance / safe range                         |
| ---------------------- | --------------------- | ----------------------------------------------- |
| `FENCE_DEFAULT_SIZE`   | 240 x 24              | Six post gaps at human scale (D200)             |
| `FENCE_POST_SPACING`   | 40                    | About one character wide; 24 to 80              |
| `FENCE_POST_WIDTH`     | 0.5                   | Of thickness; 0.3 to 0.8                        |
| `FENCE_RAIL_HEIGHT`    | 0.16                  | Of thickness; 0.1 to 0.25                       |
| `FENCE_RAIL_TOPS`      | 0.26, 0.58            | Of thickness; both rails inside the post        |
| `FENCE_RAIL_OPACITY`   | 0.78                  | Rails behind posts                              |
| `FENCE_WOOD`           | `#8a5a33` / `#c08a5b` | Wood brown per paper (D201)                     |
| `FENCE_REACH`          | 12                    | Feet half-width at Regular size; 8 to 20 (D202) |
| `FENCE_STALL`          | 0.25                  | Canvas px; below visible motion                 |
| `FENCE_APPROACH_STEPS` | 7                     | 13 px step to 0.1 px                            |
