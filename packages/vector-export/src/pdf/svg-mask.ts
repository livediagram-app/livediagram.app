// A knockout mask as a clip (liveworkspace/docs/specs/013-export/vector-pdf.md "Pictures and the fallback"): a mask
// that is one opaque white shape with opaque black shapes cut out of it shows exactly the white less the black, which
// PDF clips by even-odd. livediagram cuts a connector under its label this way. Any other mask (grey, translucent,
// soft, overlapping holes) falls back to a picture.
import { multiply, type Matrix } from './matrix';
import { parseColor } from './svg-color';
import { byId, type SvgContext } from './svg-context';
import { segmentsToPdf, type Segment } from './svg-path';
import { segmentBounds, shapeSegments, transformSegments } from './svg-shapes';
import { styleOf } from './svg-style';
import { parseTransform, type Box } from './svg-transform';

const inside = (a: Box, b: Box) =>
  a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The shade of a mask child: 'white' or 'black' when it is filled opaque with one of them and draws nothing else. */
function shadeOf(el: Element): 'white' | 'black' | null {
  const style = styleOf(el);
  if (style('stroke') !== 'none' || style('filter') !== 'none' || style('mask') !== 'none')
    return null;
  if (style('clip-path') !== 'none' || style('display') === 'none') return null;
  if (parseFloat(style('opacity')) < 1 || parseFloat(style('fill-opacity')) < 1) return null;
  const c = parseColor(style('fill'));
  if (!c || c.a < 1) return null;
  if (c.r === 1 && c.g === 1 && c.b === 1) return 'white';
  if (c.r === 0 && c.g === 0 && c.b === 0) return 'black';
  return null;
}

/** The mask `id` as an even-odd clip in the element's user space, or null when it is not a knockout. */
export function knockoutClip(ctx: SvgContext, id: string): { ops: string; evenOdd: true } | null {
  const mask = byId(ctx, id);
  if (!mask || mask.localName !== 'mask') return null;
  // In the element's own user space only: a box-relative mask would need its box.
  if (mask.getAttribute('maskUnits') !== 'userSpaceOnUse') return null;
  if ((mask.getAttribute('maskContentUnits') ?? 'userSpaceOnUse') !== 'userSpaceOnUse') return null;
  const n = (name: string) => parseFloat(mask.getAttribute(name) ?? '');
  const region: Box = { x: n('x'), y: n('y'), w: n('width'), h: n('height') };
  if (![region.x, region.y, region.w, region.h].every(Number.isFinite)) return null;
  const parts: { segs: Segment[]; box: Box; shade: 'white' | 'black' }[] = [];
  for (const child of mask.children) {
    const own = shapeSegments(child);
    const shade = own && shadeOf(child);
    if (!own || !shade) return null;
    const m: Matrix = multiply(
      parseTransform(mask.getAttribute('transform')),
      parseTransform(child.getAttribute('transform')),
    );
    const segs = transformSegments(own, m);
    const box = segmentBounds(segs);
    if (!box) return null;
    parts.push({ segs, box, shade });
  }
  const [white, ...holes] = parts;
  if (!white || white.shade !== 'white' || !inside(white.box, region)) return null;
  for (const [i, h] of holes.entries()) {
    if (h.shade !== 'black' || !inside(h.box, white.box)) return null;
    // Holes that overlap would cancel each other out under even-odd.
    for (const other of holes.slice(i + 1)) if (overlap(h.box, other.box)) return null;
  }
  return { ops: segmentsToPdf(parts.flatMap((p) => p.segs)), evenOdd: true };
}
