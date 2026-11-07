// A Door's drawing by type (docs/specs/009-elements/room-builder.md "Door types"): the parts the
// canvas (DoorView) and the export (svg-render-faces) both draw, in the door's own px with the wall's centre line along
// y = height / 2. A moving part carries its open and shut poses, so the canvas eases between them and the export draws
// the one it is in. Pure: no React, no DOM.

import { ROOM_WALL } from '@liveworkspace/avatar/office-geometry';
import { doorParts } from './room-builder';
import { pieceVariant } from './piece-variants';

/** Where a moving part stands: turned `rotate` degrees about the part's origin, then slid `dx` along the wall. */
export type DoorPose = { rotate: number; dx: number };

/**
 * How a part is painted. `floor` the gap it cuts, in the floor; `jamb` and `leaf` the floor's fill outlined in the
 * stroke; `glass` the stroke as a faint pane, outlined; `pane` the same wash unoutlined (a drum's floor); `wing` a revolving door's wings, the stroke's line; `swing` the
 * dashed swing arc; `track` a thin rail; `ink` the stroke itself (a filled hub).
 */
export type DoorPaint =
  'floor' | 'jamb' | 'leaf' | 'glass' | 'pane' | 'wing' | 'swing' | 'track' | 'ink';

export type DoorArtPart = (
  | { tag: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { tag: 'path'; d: string }
  | { tag: 'circle'; cx: number; cy: number; r: number }
) & {
  paint: DoorPaint;
  // A part that moves as the door opens and shuts: its two poses about `origin`.
  motion?: { origin: { x: number; y: number }; open: DoorPose; shut: DoorPose };
  // A part drawn only while the door is open (a swing arc).
  openOnly?: true;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const STILL: DoorPose = { rotate: 0, dx: 0 };

/** A door's parts for its type (an absent or unknown `variant` is the swing Door). */
export function doorArt(width: number, height: number, variant: string | undefined): DoorArtPart[] {
  const type = pieceVariant({ shape: 'door', variant });
  const { gap, jambs, leaf, swing } = doorParts(width, height);
  const mid = height / 2;
  const jamb = jambs[0]!.w;
  const reach = Math.max(0, width - 2 * jamb);
  const parts: DoorArtPart[] = [
    { tag: 'rect', ...gap, rx: 0, paint: 'floor' },
    ...jambs.map((j): DoorArtPart => ({ tag: 'rect', ...j, rx: 0, paint: 'jamb' })),
  ];
  if (type === 'double') {
    const half = reach / 2;
    const leafOf = (x: number, hinge: number, shut: number): DoorArtPart => ({
      tag: 'rect',
      x: r2(x),
      y: r2(mid),
      w: 3,
      h: r2(half),
      rx: 1,
      paint: 'leaf',
      motion: { origin: { x: r2(hinge), y: r2(mid) }, open: STILL, shut: { rotate: shut, dx: 0 } },
    });
    parts.push(
      {
        tag: 'path',
        d: `M${r2(jamb + half)} ${r2(mid)} A${r2(half)} ${r2(half)} 0 0 1 ${r2(jamb + 1.5)} ${r2(mid + half)}`,
        paint: 'swing',
        openOnly: true,
      },
      {
        tag: 'path',
        d: `M${r2(width - jamb - half)} ${r2(mid)} A${r2(half)} ${r2(half)} 0 0 0 ${r2(width - jamb - 1.5)} ${r2(mid + half)}`,
        paint: 'swing',
        openOnly: true,
      },
      leafOf(jamb, jamb + 1.5, -90),
      leafOf(width - jamb - 3, width - jamb - 1.5, 90),
    );
  } else if (type === 'sliding') {
    // Two panes on a track, meeting in the middle shut; open, each slides into the wall beside the gap.
    const half = reach / 2;
    const y = r2(mid - 2);
    const edge = ROOM_WALL / 2;
    const away = r2(half - 4);
    parts.push(
      {
        tag: 'path',
        d: `M${r2(jamb)} ${r2(mid + edge)}H${r2(width - jamb)}M${r2(jamb)} ${r2(mid - edge)}H${r2(width - jamb)}`,
        paint: 'track',
      },
      {
        tag: 'rect',
        x: r2(jamb),
        y,
        w: r2(half),
        h: 4,
        rx: 1,
        paint: 'glass',
        motion: { origin: { x: 0, y: 0 }, open: { rotate: 0, dx: -away }, shut: STILL },
      },
      {
        tag: 'rect',
        x: r2(jamb + half),
        y,
        w: r2(half),
        h: 4,
        rx: 1,
        paint: 'glass',
        motion: { origin: { x: 0, y: 0 }, open: { rotate: 0, dx: away }, shut: STILL },
      },
    );
  } else if (type === 'revolving') {
    // A glass drum round four wings: open, the wings stand at 45 degrees and leave a way through; shut, they square
    // up, one lying along the wall line.
    const cx = r2(width / 2);
    const r = r2(reach / 2);
    const at = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      return `${r2(cx + r * Math.cos(a))} ${r2(mid + r * Math.sin(a))}`;
    };
    const wing = r2(r - 2);
    parts.push(
      { tag: 'circle', cx, cy: r2(mid), r, paint: 'pane' },
      {
        tag: 'path',
        d: `M${at(130)} A${r} ${r} 0 0 1 ${at(230)}M${at(-50)} A${r} ${r} 0 0 1 ${at(50)}`,
        paint: 'jamb',
      },
      {
        tag: 'path',
        d: `M${r2(cx - wing)} ${r2(mid)}H${r2(cx + wing)}M${cx} ${r2(mid - wing)}V${r2(mid + wing)}`,
        paint: 'wing',
        motion: { origin: { x: cx, y: r2(mid) }, open: { rotate: 45, dx: 0 }, shut: STILL },
      },
      { tag: 'circle', cx, cy: r2(mid), r: 3, paint: 'ink' },
    );
  } else {
    parts.push(
      { tag: 'path', d: swing, paint: 'swing', openOnly: true },
      {
        tag: 'rect',
        ...leaf,
        rx: 1,
        paint: 'leaf',
        motion: {
          origin: { x: r2(leaf.x + leaf.w / 2), y: leaf.y },
          open: STILL,
          shut: { rotate: -90, dx: 0 },
        },
      },
    );
  }
  return parts;
}

/** A pose as an SVG transform attribute (the export, which draws the one pose the door is in); '' for none. */
export function doorPoseTransform(pose: DoorPose, origin: { x: number; y: number }): string {
  const parts: string[] = [];
  if (pose.dx !== 0) parts.push(`translate(${pose.dx} 0)`);
  if (pose.rotate !== 0) parts.push(`rotate(${pose.rotate} ${origin.x} ${origin.y})`);
  return parts.join(' ');
}
