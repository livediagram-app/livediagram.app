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

const RECT = /<rect\b([^>]*?)(\/?)>/g;
const THICK_LINE =
  /(<(?:rect|circle|ellipse|path|line|polyline|polygon)\b[^>]*?\sstroke-width=")2(")/g;

/** Professional: every rectangle square (a circle's or a pill's ends kept), every 2 px line 1 px. */
// A sticker's shadow (sticker-markup.ts): Professional and Marker draw none.
const STICKER_SHADOW = /<rect\b[^>]*data-sticker-shadow[^>]*\/>/g;

export function svgProfessionalFace(markup: string): string {
  return markup
    .replace(STICKER_SHADOW, '')
    .replace(RECT, (tag, attrs: string, close: string) => {
      const a = faceAttrs(attrs);
      if (!a.rx && !a.ry) return tag;
      if (a['data-finish-keep'] !== undefined) return tag;
      if (isPillRect(Number(a.width), Number(a.height), Number(a.rx ?? a.ry))) return tag;
      return `<rect${attrs.replace(/\s(rx|ry)="[^"]*"/g, '')}${close}>`;
    })
    .replace(THICK_LINE, '$11$2');
}

// Blocks that are never drawn as they stand (clips, masks, patterns, markers, definitions), a foreignObject's HTML,
// and the hand-drawn body (svgMarkerDrawing, already drawn in marker): kept whole, never redrawn.
const HELD =
  /<(clipPath|mask|defs|pattern|marker|symbol|foreignObject)\b[^>]*>[\s\S]*?<\/\1>|<g [^>]*data-finish="marker">[\s\S]*?<\/g>/g;
const PART = /<(rect|circle|ellipse|path|polygon|polyline|line)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;

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

/** Marker (and, with `pen` 'pencil', Sketch's shading of the same shapes): a face's frames outlined, its shapes coloured in and outlined, its lines drawn in one marker stroke, each
 *  over its own part (markerFacePart); everything else, and every small part, as drawn. `face` is the element's box. */
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
  return markup
    .replace(STICKER_SHADOW, '')
    .replace(HELD, (block) => `<!--lvd-held-${held.push(block) - 1}-->`)
    .replace(PART, (tag, name: string, attrs: string, end: string) => {
      if (drawn >= MARKER_FACE_MAX_PARTS) return tag;
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
      const plain = `<${name}${attrs.replace(/\sstroke(-[a-z]+)?="[^"]*"/g, '')}${end}`;
      const transform = a.transform ? `<g transform="${a.transform}">${part.svg}</g>` : part.svg;
      return (part.role === 'line' ? '' : plain) + transform;
    })
    .replace(/<!--lvd-held-(\d+)-->/g, (_, i: string) => held[Number(i)]!);
}
