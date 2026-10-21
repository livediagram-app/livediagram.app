# Avatar Pad: blueprint

Derived from [Avatar Pad](../avatar-pad.md) and [Avatar mode](../../008-canvas/avatar-mode.md) "Where it lives" /
"Entering on a pad". The spec decides; this file only adds engineering precision. Defaults applied where the spec is
silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                            | Role                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/document/src/avatar-palette.ts`                       | `AVATAR_PALETTE`: the sprite's tones, shared by the sprite and the pad          |
| `packages/document/src/avatar-pad.ts`                           | Grid, tones, `AVATAR_PAD_PARTS`, `avatarPadArtRect`, `avatarPadCore`, footprint |
| `packages/document/src/shape-kind.ts`, `validate.ts`            | `'avatar-pad'` in `ShapeKind` and `SHAPE_KINDS`                                 |
| `packages/document/src/shape-factory.ts`                        | 128 x 80, `label: ''`, `aspectLocked: true`                                     |
| `packages/document/src/office.ts`                               | `isFloorShape('avatar-pad')`: added behind, painted with the floors             |
| `packages/document/src/behaviour-shapes.ts`                     | In `BEHAVIOUR_SHAPES`; no shared settings `…`                                   |
| `packages/document/src/data-shapes.ts`, `element-types.ts`      | Self-drawing, untyped: no label, no caret                                       |
| `packages/document/src/colors.ts`                               | Transparent skin; in `SELF_PAINTING_SHAPES`                                     |
| `packages/document/src/svg-render-faces.ts`                     | `avatarPadArt`: the export pixels                                               |
| `apps/live/components/canvas/avatar-sprite-palette.ts`          | Re-exports the sprite tones from `AVATAR_PALETTE`                               |
| `apps/live/components/canvas/collab/AvatarPadView.tsx`          | The canvas pixels; the shimmering lights group                                  |
| `apps/live/components/canvas/BoxedElementView.tsx`              | Mounts `AvatarPadView`                                                          |
| `apps/live/components/canvas/shape-svg-overlay.tsx`             | Not an SVG-overlay shape                                                        |
| `apps/live/lib/avatar-pad.ts`                                   | `pickSpawnPad`, `padEntry`, `padUnderFeet`, `nextArrivals`, constants           |
| `apps/live/hooks/canvas/useAvatarWalk.ts`                       | Entry order: pad, button, remembered spot, view centre; camera; telemetry       |
| `apps/live/hooks/canvas/useAvatarPadArrivals.ts`                | Arrivals from presence: own and peers'                                          |
| `apps/live/components/canvas/AvatarPadArrivals.tsx`             | The beam, floor flash and sparks                                                |
| `apps/live/components/canvas/useCanvasAvatar.tsx`, `Canvas.tsx` | Compose the arrivals; draw them over the characters                             |
| `apps/live/app/canvas-motion.css`                               | `avatar-pad-shimmer`, `-beam`, `-flash`, `-spark`; reduced motion               |
| `apps/live/components/palette/palette-tile-defs.tsx`            | `tools:avatar-pad` in **Navigate** (`tileGroup: 'move'`)                        |
| `apps/live/components/palette/palette-icons.tsx`                | `AvatarPadIcon`                                                                 |
| `apps/live/components/palette/canvas-tool-options.tsx`          | `BOARD_ONLY_TOOLS`: Avatar listed only while in force                           |
| `apps/live/lib/editor-commands.ts`, `editor-shortcut-keys.ts`   | No `tool:avatar`, no `W`                                                        |
| `packages/api-schema/src/telemetry-schema.ts`                   | `Avatar-pad` element type token                                                 |

## Domain and naming

| Term            | Identifier                        | Meaning                                                  |
| --------------- | --------------------------------- | -------------------------------------------------------- |
| Pad             | shape kind `'avatar-pad'`         | The element                                              |
| Grid            | `AVATAR_PAD_GRID` (32 x 20)       | The pixel grid the drawing is on                         |
| Part            | `AvatarPadPart`                   | One row run of same-coloured pixels, with a `role`       |
| Core            | `avatarPadCore(pad)`              | Where a starting character's feet go, canvas px, rotated |
| Footprint       | `avatarPadFootprint(pad)`         | Top face half-axes, for "standing on the pad"            |
| Spawn pad       | `pickSpawnPad(pads, centre)`      | The pad an entry starts on                               |
| Entry           | `padEntry(elements, c, onScreen)` | Feet + whether the view recentres                        |
| Arrival         | `PadArrival`                      | One beam: person, pad, feet, colour, start               |
| Board-only tool | `BOARD_ONLY_TOOLS`                | A mode only a Selection Mode button enters (Avatar)      |

Banned synonyms: "spawn point" as an identifier (the button's one-shot is `spawnAtRef`), "teleporter", "portal" for a
pad.

## Behaviour and state

The pad has no state. Entry, in `useAvatarWalk`'s `enterOrLeave(true)`:

1. `padEntry(elements, viewportCentre(), onScreen)`: `elements` are the visible layers' (`walkElements`).
   - Some pad → clear `spawnAtRef`, place feet at its core facing down, `setViewportOffset(centred on the core)` iff
     the core is off screen, `track('Canvas', 'Used', 'AvatarPadArrival')`, stop.
2. `spawnAtRef.current` → place there, clear it, stop.
3. The remembered `posRef` on screen → keep it.
4. Else the view centre.

`pickSpawnPad`: minimum Euclidean distance core → view centre, strict `<` so the earliest in array (layer) order
wins ties; no centre → the first pad. Nothing re-runs on an element change while active (I1).

Arrivals, in `useAvatarPadArrivals`: `presentKey` = `self?` + peer ids. On each change of `presentKey`,
`nextArrivals` with `seen` = the previous frame's ids; then `seen` = this frame's ids. A timer drops finished beams.

Invariants:

- **I1:** placing, moving or deleting a pad never moves a character already in the mode.
- **I2:** nothing about a pad, a spawn or an arrival is written to the document, D1, the room or undo.
- **I3:** at most `AVATAR_PAD_MAX_ARRIVALS` beams are mounted; each unmounts within `AVATAR_PAD_ARRIVAL_MS` + one timer.
- **I4:** a character walking onto a pad, or teleported onto one by a portal, starts no beam (its id was seen).
- **I5:** the picker lists `avatar` only while `canvasTool === 'avatar'`; no key and no command enters it.

## Interfaces and contracts

```ts
// packages/document/src/avatar-pad.ts
export const AVATAR_PAD_GRID = { width: 32, height: 20 } as const;
export const AVATAR_PAD_DEFAULT_SIZE = { width: 128, height: 80 } as const;
export const AVATAR_PAD_TONES: {
  outline;
  side;
  sideDark;
  top;
  topShade;
  rim;
  groove;
  ring;
  ringLit;
  core;
  coreHot;
  lamp;
};
export type AvatarPadPartRole = 'body' | 'ring' | 'core' | 'lamp';
export type AvatarPadPart = {
  x: number;
  y: number;
  width: number;
  role: AvatarPadPartRole;
  fill: string;
};
export const AVATAR_PAD_PARTS: readonly AvatarPadPart[];
export function avatarPadArtRect(box: { width: number; height: number }): {
  x: number;
  y: number;
  scale: number;
};
export function avatarPadCore(pad: PadBox): { x: number; y: number };
export function avatarPadFootprint(pad: PadBox): { rx: number; ry: number };

// apps/live/lib/avatar-pad.ts
export const AVATAR_PAD_ARRIVAL_MS = 900;
export const AVATAR_PAD_MAX_ARRIVALS = 8;
export function avatarPads(elements: readonly Element[]): ShapeElement[];
export function pickSpawnPad(
  pads: readonly ShapeElement[],
  viewCentre: AvatarPoint | null,
): ShapeElement | null;
export function padEntry(elements, viewCentre, onScreen): { pad; feet; recentre } | null;
export function padUnderFeet(pads, feet): ShapeElement | null;
export function nextArrivals(input: { arrivals; seen; present; pads; now }): readonly PadArrival[];
```

| Input                       | Handling                                             |
| --------------------------- | ---------------------------------------------------- |
| Box not 32:20               | Grid scaled whole (`meet`), centred                  |
| Box of zero width or height | Scale 0: nothing drawn, footprint empty, no arrivals |
| `rotation` absent           | 0                                                    |
| Peer colour not `#rrggbb`   | Beam in `AVATAR_PALETTE.shirt`                       |
| No view rect (not mounted)  | First pad; no recentre                               |

## Data and persistence

- The element: an ordinary `ShapeElement` with `shape: 'avatar-pad'`; no fields of its own. Saved, copied, exported and
  validated like any shape (`SHAPE_KINDS`). No migration: a client without the kind drops it as an unknown shape, as
  for every new kind.
- Arrivals, the spawn and the shimmer are transient view state (I2).

## Errors and edge cases

| Case                                  | Handling                                              |
| ------------------------------------- | ----------------------------------------------------- |
| Pad on a hidden layer                 | Not in `walkElements`: entry falls through            |
| Pad deleted while walking             | Nothing moves (I1)                                    |
| Peer joins already standing on a pad  | One beam on your screen when they first appear (spec) |
| Two pads equidistant                  | Earliest in layer order                               |
| Forty people arrive together          | Eight beams, oldest dropped                           |
| Reduced motion                        | `.avatar-pad-arrival { display: none }`, no shimmer   |
| Already in Avatar mode, picker opened | Shows Avatar current; any other pick leaves           |

## Security and trust

The spawn is decided on each owner's machine, like every position in Avatar mode; a peer can already publish any
position, so the pad adds no new trust. Arrivals read only presence that is already parsed (`buildRemoteAvatarRows`),
draw the colour only when it is a plain hex, and are capped (I3). Placing a pad is an element edit, gated like any
(an Editor's; the Participant palette does not offer it).

## Performance and limits

- Drawing: 134 rects per pad, built once at module load (`AVATAR_PAD_PARTS`); the canvas view is memoised with no
  per-render props but the animation class. Export emits the same 134 rects.
- Shimmer: one stepped opacity loop on one `<g>` per pad (4 steps per 2.4s), no inherited custom properties.
- Arrival rule: runs only when the set of characters on screen changes (`presentKey`), O(people x pads); never per
  walked frame or presence packet.
- Beam: three groups, 23 rects (five flash rows, four fading bands of three columns, six sparks), stepped keyframes (9, 7 and 8 steps), unmounted after 900ms (I3).
- Entry: one pass over the visible elements, once per entry.

## Presentation and UX

As the spec "The element" and "The arrival". The beam box is 80 x 200 canvas px (`BEAM_W`, `BEAM_H`, D211), drawn on a
2-canvas-px grid, its foot on the feet so the floor flash lies across the pad's top. Tile: **Avatar Pad**,
blurb "Where Avatars arrive".

## Accessibility

- The pad's SVG is `role="img"` named "Avatar Pad"; the beam is `aria-hidden` decoration.
- Motion: `prefers-reduced-motion` and `:root.reduce-motion` stop the shimmer and hide the beam.
- Colour: the pad's identity does not depend on hue (outline, side and top read in grey on any paper).

## Web Experience

No layout shift: the beam is absolutely positioned inside the transformed canvas wrapper. No main-thread work on load:
the parts table is a few hundred array entries built once. INP: entry adds one O(n) pass, well under a frame.

## Observability

`Canvas·Used·AvatarPadArrival` once per entry on a pad; `Element·Added·Avatar-pad` on placement. No per-peer event.

## Testing

| Rule                                                   | Test                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Drawing on its grid, merged, palette, tints            | `packages/document/src/avatar-pad.test.ts`                                                     |
| Scale whole, centred; core and footprint; rotation     | same                                                                                           |
| Kind registration, factory, export pixels              | same                                                                                           |
| Spawn pad: nearest, tie by layer, none, no view        | `apps/live/lib/avatar-pad.test.ts`                                                             |
| Arrivals: new on a pad, not seen, cap, replace, expiry | same                                                                                           |
| Entry order, recentre, telemetry, I1, every entry      | `apps/live/hooks/canvas/useAvatarWalk.pad.test.tsx`                                            |
| Own and peer beams from presence, once, expiry         | `apps/live/hooks/canvas/useAvatarPadArrivals.test.tsx`                                         |
| View pixels and shimmer group; beam placement, colour  | `apps/live/components/canvas/AvatarPadArrivals.test.tsx`                                       |
| I5: picker, key, command                               | `canvas-tool-options.test.ts`, `useEditorKeyboardShortcuts.test.ts`, `editor-commands.test.ts` |
| A peer walks in from a board button                    | `apps/live/e2e/realtime-peers.spec.ts`                                                         |

## Constants and configuration

| Constant                  | Value    | Provenance                                               | Safe range     |
| ------------------------- | -------- | -------------------------------------------------------- | -------------- |
| `AVATAR_PAD_GRID`         | 32 x 20  | Round platform proportions at sprite chunkiness          | fixed          |
| `AVATAR_PAD_DEFAULT_SIZE` | 128 x 80 | 4 canvas px per grid pixel (D212)                        | 64 to 256 wide |
| `AVATAR_PAD_ARRIVAL_MS`   | 900      | Under a second; matches `avatar-pad-beam`                | 600 to 1200    |
| `AVATAR_PAD_MAX_ARRIVALS` | 8        | A full row of arrivals without filling the canvas (D213) | 4 to 16        |

## Assets and external resources

None: the pad and beam are generated pixel tables in source.

## Defaults ledger

D211 (beam size), D212 (default size), D213 (arrival cap).
