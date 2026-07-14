// Excalidraw import (spec/87): parse a `.excalidraw` scene (Excalidraw's
// plain-JSON save format) into livediagram elements for the Import dialog's
// replace-the-tab flow. Sibling of markdown-import.ts; lazy-loaded by
// useTabImport. Never throws on bad input — user-supplied JSON is expected
// to be wrong sometimes.
//
// Ids are re-minted to fresh UUIDs here (with a map so arrow bindings and
// group memberships follow), so the caller doesn't need the JSON path's
// remintElementIds step and imported elements can't collide with anything
// already on the diagram.

import {
  anchorPosition,
  ALL_ANCHORS,
  type Anchor,
  type ArrowElement,
  type ArrowheadShape,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type Endpoint,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';

// The slice of an Excalidraw element we read. Everything is optional —
// the format is additive across versions and we ignore what we don't map.
type ExcalidrawElement = {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  opacity?: number;
  groupIds?: string[];
  roundness?: unknown;
  isDeleted?: boolean;
  locked?: boolean;
  link?: string | null;
  name?: string | null;
  // text
  text?: string;
  originalText?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  // arrow / line / freedraw
  points?: [number, number][];
  startBinding?: { elementId?: string } | null;
  endBinding?: { elementId?: string } | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
};

export type ExcalidrawImportResult =
  | { ok: true; elements: Element[]; backgroundColor?: string; skipped: number }
  | { ok: false; error: string };

// --- Property maps ----------------------------------------------------

const mapStrokeWidth = (w: number | undefined): BorderStroke | undefined =>
  w === undefined ? undefined : w <= 1 ? 'thin' : w <= 2.5 ? 'medium' : 'thick';

const mapStrokeStyle = (s: string | undefined): BorderStyle | undefined =>
  s === 'dashed' || s === 'dotted' ? s : undefined;

const mapTextSize = (px: number | undefined): TextSize | undefined =>
  px === undefined ? undefined : px <= 16 ? 'sm' : px <= 22 ? 'md' : 'lg';

// Excalidraw font families: 1 hand-drawn (Virgil), 2 normal, 3 code.
const mapFont = (family: number | undefined): string | undefined =>
  family === 1 ? 'caveat' : family === 3 ? 'roboto-mono' : undefined;

const mapAlignX = (a: string | undefined): TextAlignX | undefined =>
  a === 'left' || a === 'center' || a === 'right' ? a : undefined;

const mapAlignY = (a: string | undefined): TextAlignY | undefined =>
  a === 'top' ? 'top' : a === 'middle' ? 'middle' : a === 'bottom' ? 'bottom' : undefined;

// Radians (Excalidraw, clockwise) -> degrees (ours, clockwise). 0 omitted.
const mapRotation = (angle: number | undefined): number | undefined =>
  angle ? Math.round((angle * 180) / Math.PI) : undefined;

// 0-100 (Excalidraw) -> 0..1 (ours); full opacity omitted.
const mapOpacity = (o: number | undefined): number | undefined =>
  o === undefined || o >= 100 ? undefined : Math.max(0, o / 100);

// Excalidraw arrowhead vocabulary -> our head-shape presets. `bar` has no
// counterpart, the open V is the closest read.
const ARROWHEAD_MAP: Record<string, ArrowheadShape> = {
  arrow: 'line',
  bar: 'line',
  triangle: 'triangle',
  triangle_outline: 'triangle-hollow',
  dot: 'circle',
  circle: 'circle',
  circle_outline: 'circle-hollow',
  diamond: 'diamond',
  diamond_outline: 'diamond-hollow',
};

// The fields every imported element shares. `fillColor` keeps the CSS
// `transparent` keyword so unfilled Excalidraw shapes stay unfilled here
// (leaving it unset would hand the fill to the theme instead).
function commonBoxedFields(src: ExcalidrawElement, groupId: string | undefined) {
  return {
    x: src.x ?? 0,
    y: src.y ?? 0,
    width: Math.max(1, src.width ?? 1),
    height: Math.max(1, src.height ?? 1),
    ...(src.backgroundColor ? { fillColor: src.backgroundColor } : {}),
    ...(src.strokeColor ? { strokeColor: src.strokeColor } : {}),
    ...(mapStrokeWidth(src.strokeWidth) ? { strokeWidth: mapStrokeWidth(src.strokeWidth) } : {}),
    ...(mapStrokeStyle(src.strokeStyle) ? { strokeStyle: mapStrokeStyle(src.strokeStyle) } : {}),
    ...(mapOpacity(src.opacity) !== undefined ? { opacity: mapOpacity(src.opacity) } : {}),
    ...(mapRotation(src.angle) !== undefined ? { rotation: mapRotation(src.angle) } : {}),
    ...(groupId ? { groupId } : {}),
    ...(src.locked ? { locked: true } : {}),
    ...(src.link ? { link: { kind: 'url' as const, url: src.link } } : {}),
  };
}

// Absolute position of an arrow/line/freedraw sample (points are stored
// relative to the element's x/y).
const absPoint = (src: ExcalidrawElement, p: [number, number]) => ({
  x: (src.x ?? 0) + p[0],
  y: (src.y ?? 0) + p[1],
});

// Nearest of the 8 anchors on `target` to `point` — how a binding whose
// exact face Excalidraw derives dynamically becomes one of our pinned faces.
function nearestAnchor(target: BoxedElement, point: { x: number; y: number }): Anchor {
  let best: Anchor = 'e';
  let bestD = Infinity;
  for (const anchor of ALL_ANCHORS) {
    const at = anchorPosition(target, anchor);
    const d = (at.x - point.x) ** 2 + (at.y - point.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = anchor;
    }
  }
  return best;
}

// --- The converter ----------------------------------------------------

export function buildElementsFromExcalidraw(text: string): ExcalidrawImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "File isn't valid JSON." };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Expected a JSON object at the top level.' };
  }
  const scene = raw as {
    type?: unknown;
    elements?: unknown;
    appState?: { viewBackgroundColor?: unknown };
  };
  if (scene.type !== 'excalidraw') {
    return {
      ok: false,
      error: 'This file isn\'t an Excalidraw scene (missing "type": "excalidraw").',
    };
  }
  if (!Array.isArray(scene.elements)) {
    return { ok: false, error: 'Scene is missing its elements array.' };
  }

  const src = (scene.elements as ExcalidrawElement[]).filter(
    (e): e is ExcalidrawElement => !!e && typeof e === 'object' && !e.isDeleted,
  );

  // Fresh ids for everything, plus one shared id per Excalidraw group.
  // Our groups are one level, so the OUTERMOST group (last groupIds entry)
  // is the membership that keeps things moving together.
  const idMap = new Map<string, string>();
  for (const e of src) if (e.id) idMap.set(e.id, crypto.randomUUID());
  const groupIdMap = new Map<string, string>();
  const groupIdFor = (e: ExcalidrawElement): string | undefined => {
    const outer = e.groupIds?.[e.groupIds.length - 1];
    if (!outer) return undefined;
    if (!groupIdMap.has(outer)) groupIdMap.set(outer, crypto.randomUUID());
    return groupIdMap.get(outer);
  };

  // Bound labels: text elements with a containerId are consumed into their
  // container rather than imported standalone.
  const boundText = new Map<string, ExcalidrawElement>();
  for (const e of src) {
    if (e.type === 'text' && e.containerId && idMap.has(e.containerId)) {
      boundText.set(e.containerId, e);
    }
  }

  const boxedById = new Map<string, BoxedElement>();
  const boxed: BoxedElement[] = [];
  const arrowSources: ExcalidrawElement[] = [];
  let skipped = 0;

  const labelFields = (t: ExcalidrawElement | undefined) =>
    t
      ? {
          ...(t.originalText || t.text ? { label: t.originalText ?? t.text } : {}),
          ...(t.strokeColor ? { textColor: t.strokeColor } : {}),
          ...(mapTextSize(t.fontSize) ? { textSize: mapTextSize(t.fontSize) } : {}),
          ...(mapFont(t.fontFamily) ? { font: mapFont(t.fontFamily) } : {}),
          ...(mapAlignX(t.textAlign) ? { textAlignX: mapAlignX(t.textAlign) } : {}),
          ...(mapAlignY(t.verticalAlign) ? { textAlignY: mapAlignY(t.verticalAlign) } : {}),
        }
      : {};

  for (const e of src) {
    const id = (e.id && idMap.get(e.id)) || crypto.randomUUID();
    const groupId = groupIdFor(e);
    const common = commonBoxedFields(e, groupId);
    let el: BoxedElement | null = null;

    switch (e.type) {
      case 'rectangle':
        el = {
          id,
          type: 'shape',
          shape: 'square',
          ...common,
          borderRadius: e.roundness ? 'md' : 'none',
          ...labelFields(boundText.get(e.id ?? '')),
        };
        break;
      case 'ellipse':
        el = {
          id,
          type: 'shape',
          shape: 'circle',
          ...common,
          ...labelFields(boundText.get(e.id ?? '')),
        };
        break;
      case 'diamond':
        el = {
          id,
          type: 'shape',
          shape: 'diamond',
          ...common,
          ...labelFields(boundText.get(e.id ?? '')),
        };
        break;
      case 'frame':
      case 'magicframe':
        el = {
          id,
          type: 'shape',
          shape: 'frame',
          ...common,
          ...(e.name ? { label: e.name } : {}),
        };
        break;
      case 'text':
        if (e.containerId && idMap.has(e.containerId)) break; // consumed as a label
        el = {
          id,
          type: 'text',
          ...common,
          ...(e.originalText || e.text ? { label: e.originalText ?? e.text } : {}),
          // Excalidraw keeps text ink in strokeColor.
          ...(e.strokeColor ? { textColor: e.strokeColor } : {}),
          ...(mapTextSize(e.fontSize) ? { textSize: mapTextSize(e.fontSize) } : {}),
          ...(mapFont(e.fontFamily) ? { font: mapFont(e.fontFamily) } : {}),
          ...(mapAlignX(e.textAlign) ? { textAlignX: mapAlignX(e.textAlign) } : {}),
        };
        break;
      case 'freedraw':
        el = freehandFrom(e, id, common, false);
        break;
      case 'line': {
        const pts = e.points ?? [];
        if (pts.length >= 3) {
          el = freehandFrom(e, id, common, true);
        } else {
          arrowSources.push(e); // 2-point line -> headless arrow, built below
        }
        break;
      }
      case 'arrow':
        arrowSources.push(e);
        break;
      case 'image':
        // Bytes aren't migrated in v1 (they'd need an R2 upload per file);
        // a placeholder image element keeps the layout slot (spec/87).
        el = { id, type: 'image', imageId: null, ...common };
        break;
      default:
        skipped += 1;
    }

    if (el) {
      boxed.push(el);
      if (e.id) boxedById.set(e.id, el);
    }
  }

  const arrows: ArrowElement[] = [];
  for (const e of arrowSources) {
    const pts =
      e.points && e.points.length >= 2
        ? e.points
        : ([
            [0, 0],
            [0, 0],
          ] as const);
    const first = absPoint(e, pts[0] as [number, number]);
    const last = absPoint(e, pts[pts.length - 1] as [number, number]);

    const endpoint = (
      binding: { elementId?: string } | null | undefined,
      at: { x: number; y: number },
    ): Endpoint => {
      const target = binding?.elementId ? boxedById.get(binding.elementId) : undefined;
      if (target) {
        return { kind: 'pinned', elementId: target.id, anchor: nearestAnchor(target, at) };
      }
      return { kind: 'free', x: at.x, y: at.y };
    };

    // Which ends carry a head. A missing endArrowhead field counts as
    // Excalidraw's default 'arrow'; plain lines carry none at all.
    const isLine = e.type === 'line';
    const startHead = isLine ? null : (e.startArrowhead ?? null);
    const endHead = isLine ? null : e.endArrowhead === undefined ? 'arrow' : e.endArrowhead;
    const arrowEnds = startHead && endHead ? 'both' : startHead ? 'from' : endHead ? 'to' : 'none';
    const headShape = ARROWHEAD_MAP[endHead ?? startHead ?? ''];

    // Intermediate points bend the connector: stored as deltas from the
    // chord midpoint (our multi-bend curve model, spec/09).
    const mid = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
    const curvePoints = pts.slice(1, -1).map((p) => {
      const at = absPoint(e, p as [number, number]);
      return { dx: at.x - mid.x, dy: at.y - mid.y };
    });

    arrows.push({
      id: (e.id && idMap.get(e.id)) || crypto.randomUUID(),
      type: 'arrow',
      from: endpoint(e.startBinding, first),
      to: endpoint(e.endBinding, last),
      ...(arrowEnds !== 'to' ? { arrowEnds } : {}),
      ...(headShape && headShape !== 'triangle' ? { arrowheadShape: headShape } : {}),
      ...(curvePoints.length > 0 ? { arrowStyle: 'curved' as const, curvePoints } : {}),
      ...(e.strokeColor ? { strokeColor: e.strokeColor } : {}),
      ...(e.strokeWidth !== undefined ? { strokeWidth: e.strokeWidth } : {}),
      ...(mapStrokeStyle(e.strokeStyle) ? { strokeStyle: mapStrokeStyle(e.strokeStyle) } : {}),
      ...(mapOpacity(e.opacity) !== undefined ? { opacity: mapOpacity(e.opacity) } : {}),
      ...(e.locked ? { locked: true } : {}),
      ...(e.link ? { link: { kind: 'url' as const, url: e.link } } : {}),
      ...(boundText.get(e.id ?? '')?.text
        ? { label: boundText.get(e.id ?? '')!.originalText ?? boundText.get(e.id ?? '')!.text }
        : {}),
    });
  }

  const bg = scene.appState?.viewBackgroundColor;
  return {
    ok: true,
    elements: [...boxed, ...arrows],
    ...(typeof bg === 'string' && bg ? { backgroundColor: bg } : {}),
    skipped,
  };
}

// A freedraw stroke or a multi-point line as a freehand element: bounds from
// the samples, points normalised into [0..1] across the box (our storage
// shape). `straightEdges` marks polygon-style lines so corners stay corners;
// a line whose ends coincide closes + fills like the polygon tool (spec/84).
function freehandFrom(
  e: ExcalidrawElement,
  id: string,
  common: ReturnType<typeof commonBoxedFields>,
  straightEdges: boolean,
): BoxedElement {
  const abs = (e.points ?? []).map((p) => absPoint(e, p));
  const xs = abs.map((p) => p.x);
  const ys = abs.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - minX);
  const height = Math.max(1, Math.max(...ys) - minY);
  let samples = abs;
  let closed = false;
  if (straightEdges && abs.length >= 3) {
    const a = abs[0]!;
    const b = abs[abs.length - 1]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) <= 1) {
      closed = true;
      samples = abs.slice(0, -1);
    }
  }
  return {
    id,
    type: 'freehand',
    ...common,
    x: minX,
    y: minY,
    width,
    height,
    points: samples.map((p) => ({ nx: (p.x - minX) / width, ny: (p.y - minY) / height })),
    closed,
    ...(straightEdges ? { straightEdges: true } : {}),
  };
}
