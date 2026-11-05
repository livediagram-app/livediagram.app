# Avatar Pad: blueprint

Derived from [Avatar Pad](../avatar-pad.md) and [Avatar mode](../../008-canvas/avatar-mode.md) "Where it lives" /
"Entering on a pad". The spec decides; this file only adds engineering precision. Defaults applied where the spec is
silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                              | Role                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `../packages/avatar/src/palette.ts`                               | `AVATAR_PALETTE`: the sprite's tones, shared by the sprite and the pad    |
| `../packages/avatar/src/pad-art.ts`                               | Grid, tones, `avatarPadArtRect`, `avatarPadCore`, footprint (shared)      |
| `packages/document/src/avatar-pad-art.ts`                         | `AVATAR_PAD_ART` vector table, `avatarPadPaint`, `AVATAR_PAD_CORE_POINT`  |
| `packages/document/src/shape-kind.ts`, `validate.ts`              | `'avatar-pad'` in `ShapeKind` and `SHAPE_KINDS`                           |
| `packages/document/src/shape-factory.ts`                          | 128 x 80, `label: ''`, `aspectLocked: true`                               |
| `packages/document/src/office.ts`                                 | `isFloorShape('avatar-pad')`: added behind, painted with the floors       |
| `packages/document/src/behaviour-shapes.ts`                       | In `BEHAVIOUR_SHAPES`; no shared settings `…`                             |
| `packages/document/src/data-shapes.ts`, `element-types.ts`        | Self-drawing, untyped: no label, no caret                                 |
| `packages/document/src/colors.ts`                                 | Furniture skin (theme stroke, no box); in `SELF_PAINTING_SHAPES`          |
| `packages/document/src/animation-membership.ts`                   | Wordless                                                                  |
| `packages/document/src/svg-render-faces.ts`                       | `avatarPadArt`: the export drawing                                        |
| `../packages/avatar/src/components/avatar-sprite-palette.ts`      | Re-exports the sprite tones from `AVATAR_PALETTE`                         |
| `apps/editor/components/canvas/collab/AvatarPadView.tsx`          | The canvas drawing; the shimmering lights                                 |
| `apps/editor/components/canvas/BoxedElementView.tsx`              | Mounts `AvatarPadView`                                                    |
| `apps/editor/components/canvas/shape-svg-overlay.tsx`             | Not an SVG-overlay shape                                                  |
| `apps/editor/components/canvas/useBoxedElementAnimation.ts`       | Silhouette animations on the drawing                                      |
| `../packages/avatar/src/pad.ts`                                   | `pickSpawnPad`, `padEntry`, `padUnderFeet`, `nextArrivals`, constants     |
| `../packages/avatar/src/hooks/useAvatarWalk.ts`                   | Entry order: pad, button, remembered spot, view centre; camera; telemetry |
| `../packages/avatar/src/hooks/useAvatarPadArrivals.ts`            | Arrivals from presence: own and peers'                                    |
| `../packages/avatar/src/components/AvatarPadArrivals.tsx`         | The beam, floor flash and sparks                                          |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`, `Canvas.tsx` | Compose the arrivals; draw them over the characters                       |
| `apps/editor/app/canvas-motion.css`                               | `avatar-pad-shimmer`, `-beam`, `-flash`, `-spark`; reduced motion         |
| `apps/editor/components/palette/palette-tile-defs.tsx`            | `tools:avatar-pad` in **Travel** (`tileGroup: 'travel'`)                  |
| `apps/editor/components/palette/palette-icons.tsx`                | `AvatarPadIcon`                                                           |
| `apps/editor/components/palette/canvas-tool-options.tsx`          | Avatar is always listed in the canvas-tool picker                         |
| `apps/editor/lib/editor-commands.ts`, `editor-shortcut-keys.ts`   | No `tool:avatar`, no `W`                                                  |
| `packages/api-schema/src/telemetry-schema.ts`                     | `Avatar-pad` element type token                                           |

## Domain and naming

| Term      | Identifier                        | Meaning                                                  |
| --------- | --------------------------------- | -------------------------------------------------------- |
| Pad       | shape kind `'avatar-pad'`         | The element                                              |
| Grid      | `AVATAR_PAD_GRID` (32 x 20)       | The box proportions the core geometry is measured on     |
| View      | `AVATAR_PAD_VIEW` (128 x 80)      | The drawing's units: the grid at 4 a unit                |
| Part      | `AvatarPadArtPart`                | One ellipse or path of the drawing, with a `role`        |
| Core      | `avatarPadCore(pad)`              | Where a starting character's feet go, canvas px, rotated |
| Footprint | `avatarPadFootprint(pad)`         | Top face half-axes, for "standing on the pad"            |
| Spawn pad | `pickSpawnPad(pads, centre)`      | The pad an entry starts on                               |
| Entry     | `padEntry(elements, c, onScreen)` | Feet + whether the view recentres                        |
| Arrival   | `PadArrival`                      | One beam: person, pad, feet, colour, start               |

Banned synonyms: "spawn point" as an identifier (the button's one-shot is `spawnAtRef`), "teleporter", "portal" for a
pad.

## Behaviour and state

The pad has no state. Entry, in `useAvatarWalk`'s `enterOrLeave(true)`:

1. `padEntry(elements, viewportCentre(), onScreen)`: `elements` are the tab's (`walkElements`).
   - Some pad → clear `spawnAtRef`, place feet at its core facing down, `setViewportOffset(centred on the core)` iff
     the core is off screen, `track('Canvas', 'Used', 'AvatarPadArrival')`, stop.
2. `spawnAtRef.current` → place there, clear it, stop.
3. The remembered `posRef` on screen → keep it.
4. Else the view centre.

`pickSpawnPad`: minimum Euclidean distance core → view centre, strict `<` so the earliest in array order
wins ties; no centre → the first pad. Nothing re-runs on an element change while active (I1).

Arrivals, in `useAvatarPadArrivals`: `presentKey` = `self?` + peer ids. On each change of `presentKey`,
`nextArrivals` with `seen` = the previous frame's ids; then `seen` = this frame's ids. A timer drops finished beams.

Invariants:

- **I1:** placing, moving or deleting a pad never moves a character already in the mode.
- **I2:** nothing about a pad, a spawn or an arrival is written to the document, the index, the room or undo.
- **I3:** at most `AVATAR_PAD_MAX_ARRIVALS` beams are mounted; each unmounts within `AVATAR_PAD_ARRIVAL_MS` + one timer.
- **I4:** a character walking onto a pad, or teleported onto one by a portal, starts no beam (its id was seen).
- **I5:** the picker lists `avatar` only while `canvasTool === 'avatar'`; no key and no command enters it.

## Interfaces and contracts

```ts
// ../packages/avatar/src/pad-art.ts
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
// (AVATAR_PAD_PARTS, the shared pixel table, stays for livediagram; livehuddle no longer draws it.)
export function avatarPadArtRect(box: { width: number; height: number }): {
  x: number;
  y: number;
  scale: number;
};
export function avatarPadCore(pad: PadBox): { x: number; y: number };
export function avatarPadFootprint(pad: PadBox): { rx: number; ry: number };

// packages/document/src/avatar-pad-art.ts
export const AVATAR_PAD_VIEW = { width: 128, height: 80 } as const;
export const AVATAR_PAD_CORE_POINT: { x: number; y: number }; // avatarPadCore of the view box
export type AvatarPadArtRole =
  | 'shadow'
  | 'side'
  | 'sideShade'
  | 'top'
  | 'bevel'
  | 'well'
  | 'glint'
  | 'glow'
  | 'ring'
  | 'ringLit'
  | 'lamp'
  | 'core'
  | 'coreHot';
export type AvatarPadArtPart = { tag: 'ellipse'; role; cx; cy; rx; ry } | { tag: 'path'; role; d };
export const AVATAR_PAD_ART: readonly AvatarPadArtPart[]; // 17 parts, back to front
export const AVATAR_PAD_GLOW: { color; innerOpacity };
export function isAvatarPadLight(role): boolean; // glow, ring, ringLit, lamp
export function avatarPadPaint(role, stroke, body, glowFill): AvatarPadPaint;

// ../packages/avatar/src/pad.ts
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
| Box not 32:20               | Drawing fitted whole (`meet`), centred               |
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
| Pad deleted while walking             | Nothing moves (I1)                                    |
| Peer joins already standing on a pad  | One beam on your screen when they first appear (spec) |
| Two pads equidistant                  | Earliest in element order                             |
| Forty people arrive together          | Eight beams, oldest dropped                           |
| Reduced motion                        | `.avatar-pad-arrival { display: none }`, no shimmer   |
| Already in Avatar mode, picker opened | Shows Avatar current; any other pick leaves           |

## Security and trust

The spawn is decided on each owner's machine, like every position in Avatar mode; a peer can already publish any
position, so the pad adds no new trust. Arrivals read only presence that is already parsed (`buildRemoteAvatarRows`),
draw the colour only when it is a plain hex, and are capped (I3). Placing a pad is an element edit, gated like any
(an Editor's; the Participant palette does not offer it).

## Performance and limits

- Drawing: a fixed 17 nodes per pad (`AVATAR_PAD_ART`, built once at module load) plus one static radial gradient
  (two stops) for the glow; no filters, nothing blurred per frame. The canvas view is memoised on the theme stroke,
  the animation class and the press handler. Export emits the same 17 nodes and gradient.
- Shimmer: one opacity loop on the eight light nodes (glow, ring, ring highlight, five lamps), 10 steps each way per
  1.6s, alternating, so it restyles only on its steps; no inherited custom properties.
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
- Colour: the pad's identity does not depend on hue (outline, side and top are the theme's line and wash on any paper).

## Web Experience

No layout shift: the beam is absolutely positioned inside the transformed canvas wrapper. No main-thread work on load:
the drawing is 17 entries built once. INP: entry adds one O(n) pass, well under a frame.

## Observability

`Canvas·Used·AvatarPadArrival` once per entry on a pad; `Element·Added·Avatar-pad` on placement. No per-peer event.

## Testing

| Rule                                                   | Test                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Drawn core on `avatarPadCore`, fixed nodes, tints      | `packages/document/src/avatar-pad.test.ts`                                                     |
| Scale whole, centred; core and footprint; rotation     | same                                                                                           |
| Kind registration, factory, export drawing             | same                                                                                           |
| Spawn pad: nearest, tie by order, none, no view        | `apps/editor/lib/avatar-pad.test.ts`                                                           |
| Arrivals: new on a pad, not seen, cap, replace, expiry | same                                                                                           |
| Entry order, recentre, telemetry, I1, every entry      | `apps/editor/hooks/canvas/useAvatarWalk.pad.test.tsx`                                          |
| Own and peer beams from presence, once, expiry         | `apps/editor/hooks/canvas/useAvatarPadArrivals.test.tsx`                                       |
| View nodes, theme stroke, shimmer; beam, colour        | `apps/editor/components/canvas/AvatarPadArrivals.test.tsx`                                     |
| I5: picker, key, command                               | `canvas-tool-options.test.ts`, `useEditorKeyboardShortcuts.test.ts`, `editor-commands.test.ts` |
| A peer walks in from a board button                    | `apps/editor/e2e/realtime-peers.spec.ts`                                                       |

## Constants and configuration

| Constant                  | Value    | Provenance                                               | Safe range     |
| ------------------------- | -------- | -------------------------------------------------------- | -------------- |
| `AVATAR_PAD_GRID`         | 32 x 20  | Round platform proportions; the core geometry's units    | fixed          |
| `AVATAR_PAD_VIEW`         | 128 x 80 | The grid at 4 a unit: a new pad draws 1:1                | fixed          |
| `AVATAR_PAD_DEFAULT_SIZE` | 128 x 80 | 4 canvas px per grid pixel (D212)                        | 64 to 256 wide |
| `AVATAR_PAD_ARRIVAL_MS`   | 900      | Under a second; matches `avatar-pad-beam`                | 600 to 1200    |
| `AVATAR_PAD_MAX_ARRIVALS` | 8        | A full row of arrivals without filling the canvas (D213) | 4 to 16        |

## Assets and external resources

None: the pad is a vector table and the beam a pixel table, both in source.

## Defaults ledger

D211 (beam size), D212 (default size), D213 (arrival cap).
