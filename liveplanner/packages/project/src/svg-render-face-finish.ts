// A face's own parts in its element's finish, in the export (docs/specs/008-canvas/finish.md "Faces"): what the
// canvas does with app/face-finish.css and MarkerFace, done to the face's markup. Markup is rewritten by tag, never
// parsed, as svgSketchFace does: a face is our own renderers' output, its attributes always double-quoted.
import { faceAttrs, isPillRect } from './face-finish';
import {
  MARKER_FACE_MAX_PARTS,
  MARKER_FACE_RULE_MIN_PX,
  markerFacePart,
  markerFaceSeed,
  polygonPoints,
  sketchFacePart,
  type FacePartPaint,
  type FacePartShape,
} from './marker-face';
import { mapTags, markedGroup, replaceBlocks } from './svg-markup-blocks';

const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse', 'path', 'line', 'polyline', 'polygon']);
const RECT_TAG = new Set(['rect']);

// A sticker's shadow (sticker-markup.ts): Professional and Marker draw none.
const dropStickerShadow = (markup: string) =>
  mapTags(markup, RECT_TAG, (tag, text) => (tag.attrs.includes('data-sticker-shadow') ? '' : text));

/** Professional: every rectangle square (a circle's or a pill's ends kept), every 2 px line 1 px. */
export function svgProfessionalFace(markup: string): string {
  return mapTags(dropStickerShadow(markup), SHAPE_TAGS, (tag, text) => {
    let attrs = tag.attrs.replace(/(\sstroke-width=")2(")/, '$11$2');
    if (tag.name === 'rect') {
      const a = faceAttrs(attrs);
      const keep =
        (!a.rx && !a.ry) ||
        a['data-finish-keep'] !== undefined ||
        isPillRect(Number(a.width), Number(a.height), Number(a.rx ?? a.ry));
      if (!keep) attrs = attrs.replace(/\s(rx|ry)="[^"]*"/g, '');
    }
    return attrs === tag.attrs ? text : `<${tag.name}${attrs}${tag.selfClosing ? '/' : ''}>`;
  });
}

// Blocks that are never drawn as they stand (clips, masks, patterns, markers, definitions), a foreignObject's HTML,
// and the hand-drawn body (svgMarkerDrawing, already drawn in marker): kept whole, never redrawn.
const HELD_BLOCKS = [
  'clipPath',
  'mask',
  'defs',
  'pattern',
  'marker',
  'symbol',
  'foreignObject',
] as const;
const MARKER_BODY = 'data-finish="marker"';
// A part is a self-closing shape tag, as our renderers write them; one with children keeps its plain look.

// Every held block (HELD_BLOCKS, then the marker body) swapped for a placeholder comment, its markup kept in `held`.
function holdBlocks(markup: string, held: string[]): string {
  const hold = (block: string) => `<!--lvd-held-${held.push(block) - 1}-->`;
  const out = replaceBlocks(markup, HELD_BLOCKS, hold);
  const body = markedGroup(out, MARKER_BODY);
  return body
    ? out.slice(0, body[0]) + hold(out.slice(body[0], body[1])) + out.slice(body[1])
    : out;
}

function partShape(tag: string, a: Record<string, string>): FacePartShape | null {
  const n = (k: string) => Number(a[k] ?? 0);
  switch (tag) {
    case 'rect':
      return {
        kind: 'rect',
        x: n('x'),
        y: n('y'),
        width: n('width'),
        height: n('height'),
        rx: n('rx') || n('ry'),
      };
    case 'circle':
      return { kind: 'ellipse', cx: n('cx'), cy: n('cy'), rx: n('r'), ry: n('r') };
    case 'ellipse':
      return { kind: 'ellipse', cx: n('cx'), cy: n('cy'), rx: n('rx'), ry: n('ry') };
    case 'line': {
      // A straight rule counts only at a marker's weight (a timeline's spine); axes and grid lines stay plain.
      if (Number(a['stroke-width'] ?? 1) < MARKER_FACE_RULE_MIN_PX) return null;
      const points = [
        { x: n('x1'), y: n('y1') },
        { x: n('x2'), y: n('y2') },
      ];
      return { kind: 'polyline', points };
    }
    case 'polygon':
    case 'polyline': {
      const points = a.points ? polygonPoints(a.points) : null;
      return points ? { kind: tag, points } : null;
    }
    default:
      return a.d ? { kind: 'path', d: a.d } : null;
  }
}

/** Marker (and, with `pen` 'pencil', Sketch's shading of the same shapes): a face's frames outlined, its shapes
 *  coloured in and outlined, its lines drawn in one marker stroke, each over its own part (markerFacePart); everything
 *  else, and every small part, as drawn. `face` is the element's box. */
export function svgMarkerFace(
  markup: string,
  elementId: string,
  face: { width: number; height: number },
  pen: 'marker' | 'pencil' = 'marker',
): string {
  const seed = markerFaceSeed(elementId);
  // A hand-drawn body already draws (and shades) the face's box.
  const box = { ...face, bodyDrawn: /data-finish="(marker|sketch)"/.test(markup) };
  const drawPart = pen === 'marker' ? markerFacePart : sketchFacePart;
  const held: string[] = [];
  let drawn = 0;
  return mapTags(holdBlocks(dropStickerShadow(markup), held), SHAPE_TAGS, (t, tag) => {
    const { name, attrs } = t;
    if (!t.selfClosing || drawn >= MARKER_FACE_MAX_PARTS) return tag;
    const a = faceAttrs(attrs);
    // A line carrying arrowheads, or a part marked to keep its look, is drawn as it is.
    if (a['marker-start'] || a['marker-end'] || a['data-finish-keep'] !== undefined) return tag;
    const shape = partShape(name, a);
    if (!shape) return tag;
    const stroke = a.stroke ?? null;
    const paint: FacePartPaint = {
      fill: a.fill ?? null,
      stroke,
      strokePx: stroke ? Number(a['stroke-width'] ?? 1) : 0,
      ...(a.opacity ? { opacity: Number(a.opacity) } : {}),
      ...(a['stroke-dasharray'] && a['stroke-dasharray'] !== 'none' ? { dashed: true } : {}),
      ...(a['data-marker-shape'] !== undefined ? { shape: true } : {}),
    };
    const part = drawPart(shape, paint, box, seed, drawn);
    if (!part) return tag;
    drawn += 1;
    // Pencil shading goes over the part as drawn; the face's wobble draws its line by hand.
    if (pen === 'pencil')
      return tag + (a.transform ? `<g transform="${a.transform}">${part.svg}</g>` : part.svg);
    // The part keeps its solid fill (a line has none); its outline is the marker's.
    const plain = `<${name}${attrs.replace(/\sstroke(-[a-z]+)?="[^"]*"/g, '')}/>`;
    const transform = a.transform ? `<g transform="${a.transform}">${part.svg}</g>` : part.svg;
    return (part.role === 'line' ? '' : plain) + transform;
  }).replace(/<!--lvd-held-(\d+)-->/g, (_, i: string) => held[Number(i)]!);
}
