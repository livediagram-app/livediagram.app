// Mirroring across a logo page's vertical centre line (docs/specs/007-editor/logo-pages.md
// "Mirror"): an element's twin, reflected. A path's points and a stroke's points are reflected; a
// shape takes the reflected box; text, an image and anything else move to the reflected place
// unflipped. Every one turns the other way (its rotation negated). Pure: the caller gives the twin its own id.
import type { PathNode, PathPoint } from './element-types';
import type { BoxedElement } from './index';
import { decodeStrokePoints } from '@liveworkspace/model-core/stroke-points-cache';
import { encodeStrokePoints } from '@liveworkspace/model-core/stroke-points';
import { logoPageAt } from './logo-page';
import type { LaidOutPage } from './page';
import type { AttachPoint } from './attachment';
import { isPointerNote, pointerTipOf } from './pointer-note';

// A badge or step held on a host's point holds the reflected point on the reflected host.
const MIRRORED_POINT: Record<AttachPoint, AttachPoint> = {
  'top-left': 'top-right',
  top: 'top',
  'top-right': 'top-left',
  right: 'left',
  'bottom-right': 'bottom-left',
  bottom: 'bottom',
  'bottom-left': 'bottom-right',
  left: 'right',
};

// An element whose centre is this close to the axis (a share of the artboard's width) already
// sits on it: mirroring it would only stack a copy on itself.
export const MIRROR_AXIS_TOLERANCE = 0.01;

const flipPoint = (p: PathPoint): PathPoint => ({ ...p, nx: 1 - p.nx });
const flipNode = (n: PathNode): PathNode => ({
  ...flipPoint(n),
  mode: n.mode,
  ...(n.handleIn ? { handleIn: flipPoint(n.handleIn) } : {}),
  ...(n.handleOut ? { handleOut: flipPoint(n.handleOut) } : {}),
});

/** The element reflected across the vertical line x = axisX (same id). */
export function mirrorElement<T extends BoxedElement>(el: T, axisX: number): T {
  // A reflection turns the other way: any rotation is negated, whatever the element.
  const rotation = (el as { rotation?: number }).rotation;
  const moved = {
    ...el,
    x: 2 * axisX - el.x - el.width,
    ...(rotation ? { rotation: -rotation } : {}),
  };
  // A chip's point on its host, and a pointer note's tip, reflect with it: left unflipped, attachment would settle
  // the twin back onto its host's unreflected corner.
  const attachAt = (el as { attachAt?: AttachPoint }).attachAt;
  if (attachAt && attachAt in MIRRORED_POINT)
    (moved as { attachAt?: AttachPoint }).attachAt = MIRRORED_POINT[attachAt];
  if (isPointerNote(moved)) {
    const tip = pointerTipOf(moved);
    return { ...moved, pointerTip: { x: moved.width - tip.x, y: tip.y } };
  }
  if (moved.type === 'path') {
    return {
      ...moved,
      nodes: moved.nodes.map(flipNode),
      ...(moved.subpaths ? { subpaths: moved.subpaths.map((c) => c.map(flipNode)) } : {}),
    };
  }
  if (moved.type === 'freehand') {
    const pts = decodeStrokePoints(moved.packedPoints);
    const points = Array.from({ length: pts.count }, (_, i) => ({
      nx: 1 - pts.nx[i]!,
      ny: pts.ny[i]!,
    }));
    const pressures = pts.pressures ? Array.from(pts.pressures) : undefined;
    return { ...moved, packedPoints: encodeStrokePoints(points, pressures) };
  }
  return moved;
}

type MirrorUse = 'drawing' | 'copy';

/**
 * The twin an element gets on the logo page under its centre, or null: off every logo page, on
 * the axis already, or (when drawing) not a stroke, path or shape. Mirror Copy also takes text and
 * images. Arrows never mirror.
 */
/** The centre line a box drawn here reflects across: its logo page's, unless the box sits on the
 *  line already (it would be its own twin); null off a logo page. Shared by the twin a release
 *  adds and the twin previewed while drawing, so the two always agree. */
function mirrorAxisFor(
  pages: readonly LaidOutPage[],
  box: { x: number; y: number; width: number; height: number },
): number | null {
  const cx = box.x + box.width / 2;
  const page = logoPageAt(pages, { x: cx, y: box.y + box.height / 2 });
  if (!page) return null;
  const axisX = page.rect.x + page.rect.width / 2;
  return Math.abs(cx - axisX) <= MIRROR_AXIS_TOLERANCE * page.rect.width ? null : axisX;
}

export function twinFor(
  el: BoxedElement,
  pages: readonly LaidOutPage[],
  use: MirrorUse,
): BoxedElement | null {
  const drawn = el.type === 'freehand' || el.type === 'path' || el.type === 'shape';
  if (!drawn && !(use === 'copy' && (el.type === 'text' || el.type === 'image'))) return null;
  const axisX = mirrorAxisFor(pages, el);
  if (axisX === null) return null;
  const twin = mirrorElement(el, axisX);
  return use === 'copy' ? { ...twin, locked: false } : twin;
}
