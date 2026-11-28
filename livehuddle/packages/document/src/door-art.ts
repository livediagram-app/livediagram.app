// A Door's drawing by type (docs/specs/009-elements/room-builder.md "Door types"): the parts the
// canvas (DoorView) and the export (svg-render-faces) both draw, in the door's own px with the wall's centre line along
// y = height / 2. The plan draws a door open, as an architect's plan does (room-builder.md "Opening on their own"): a
// part that stands out of the wall carries that pose about its origin. Pure: no React, no DOM.

import { ROOM_WALL } from '@livehuddle/avatar/office-geometry';
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
  // A part drawn turned or slid out of its place: the plan's open pose about `origin`.
  motion?: { origin: { x: number; y: number }; open: DoorPose };
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** How far a door's drawing reaches past its box: the open leaf and its swing arc stand out from the wall's centre
 *  line (half the height down) by up to the opening, which is never wider than the door. The raster frame (the PNG,
 *  and the PDF's raster fallback) grows by it, so the swing the SVG draws is never cut off
 *  (docs/specs/009-elements/room-builder.md "Export"). */
export function doorOverhang(width: number, height: number): number {
  return Math.max(0, width - height / 2);
}

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
    const leafOf = (x: number): DoorArtPart => ({
      tag: 'rect',
      x: r2(x),
      y: r2(mid),
      w: 3,
      h: r2(half),
      rx: 1,
      paint: 'leaf',
    });
    parts.push(
      {
        tag: 'path',
        d: `M${r2(jamb + half)} ${r2(mid)} A${r2(half)} ${r2(half)} 0 0 1 ${r2(jamb + 1.5)} ${r2(mid + half)}`,
        paint: 'swing',
      },
      {
        tag: 'path',
        d: `M${r2(width - jamb - half)} ${r2(mid)} A${r2(half)} ${r2(half)} 0 0 0 ${r2(width - jamb - 1.5)} ${r2(mid + half)}`,
        paint: 'swing',
      },
      leafOf(jamb),
      leafOf(width - jamb - 3),
    );
  } else if (type === 'sliding') {
    // Two panes on a track, each slid open into the wall beside the gap.
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
        motion: { origin: { x: 0, y: 0 }, open: { rotate: 0, dx: -away } },
      },
      {
        tag: 'rect',
        x: r2(jamb + half),
        y,
        w: r2(half),
        h: 4,
        rx: 1,
        paint: 'glass',
        motion: { origin: { x: 0, y: 0 }, open: { rotate: 0, dx: away } },
      },
    );
  } else if (type === 'revolving') {
    // A glass drum round four wings standing at 45 degrees, leaving a way through.
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
        motion: { origin: { x: cx, y: r2(mid) }, open: { rotate: 45, dx: 0 } },
      },
      { tag: 'circle', cx, cy: r2(mid), r: 3, paint: 'ink' },
    );
  } else {
    parts.push(
      { tag: 'path', d: swing, paint: 'swing' },
      {
        tag: 'rect',
        ...leaf,
        rx: 1,
        paint: 'leaf',
      },
    );
  }
  return parts;
}

/** A pose as an SVG transform attribute; '' for none. */
export function doorPoseTransform(pose: DoorPose, origin: { x: number; y: number }): string {
  const parts: string[] = [];
  if (pose.dx !== 0) parts.push(`translate(${pose.dx} 0)`);
  if (pose.rotate !== 0) parts.push(`rotate(${pose.rotate} ${origin.x} ${origin.y})`);
  return parts.join(' ');
}
