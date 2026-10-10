// Combining shapes into one path (docs/specs/007-editor/logo-pages.md "Combine"): Unite, Subtract,
// Intersect or Exclude over the elements in their stacking order, the result a closed path whose
// contours are filled even-odd, in the bottom-most element's place and style. The boolean engine
// (polygon-clipping, about 10 KB) is loaded on first use, never with the editor.
import {
  INK_PEN_COLOUR,
  isPenStroke,
  MAX_PATH_NODES,
  type BoxedElement,
  type PathElement,
  type PathNode,
} from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { elementRings, isCombinable, type Ring } from './outline';
import { simplifyRing } from './simplify';

export type CombineOp = 'unite' | 'subtract' | 'intersect' | 'exclude';

export type CombineResult =
  | { ok: true; path: PathElement; removedIds: string[] }
  | { ok: false; reason: 'empty' | 'too-detailed' | 'not-combinable' | 'failed' };

// The most traced points the engine is handed: past it the result could never be kept anyway.
export const COMBINE_MAX_INPUT_POINTS = 50_000;

type Polygon = Ring[];
type MultiPolygon = Polygon[];
// The engine's four operations. Its ESM build exports them as one default object while its types
// declare them named, so both shapes are read.
type Clipping = typeof import('polygon-clipping');

let engine: Promise<Clipping> | null = null;
// The engine once it has loaded, for work that must finish in the same commit (mirror's merge).
let loaded: Clipping | null = null;
function loadEngine(): Promise<Clipping> {
  engine ??= import('polygon-clipping').then((m) => {
    loaded = (m as unknown as { default?: Clipping }).default ?? m;
    return loaded;
  });
  engine.catch(() => {
    engine = null;
  });
  return engine;
}

/** Starts loading the engine ahead of need (Mirror While Drawing merges on release, in the draw's
 *  own commit, so it must already be there). */
export function preloadCombineEngine(): void {
  void loadEngine().catch((e) => console.warn('[combine] load failed', e));
}

// One element's area as a multipolygon: its rings resolved even-odd (a path's holes), so an
// element made of overlapping pieces counts once.
function elementArea(pc: Clipping, el: BoxedElement): MultiPolygon {
  const rings = elementRings(el);
  if (rings.length === 0) return [];
  const [first, ...rest] = rings.map((r): MultiPolygon => [[r]]);
  if (el.type === 'path') return rest.length ? pc.xor(first!, ...rest) : first!;
  return rest.length ? pc.union(first!, ...rest) : first!;
}

function runOp(pc: Clipping, op: CombineOp, areas: MultiPolygon[]): MultiPolygon {
  const [base, ...rest] = areas;
  switch (op) {
    case 'unite':
      return pc.union(base!, ...rest);
    case 'subtract':
      return pc.difference(base!, ...rest);
    case 'intersect':
      return pc.intersection(base!, ...rest);
    case 'exclude':
      return pc.xor(base!, ...rest);
  }
}

// The bottom-most element's look, carried onto the path: its colours as stored (a colour left to
// the theme stays the theme's), its line, opacity and layer. A pen stroke's colour is its fill.
function styleOf(el: BoxedElement): Partial<PathElement> {
  const out: Partial<PathElement> = {};
  const src = el as Partial<PathElement> & { strokeColor?: string; fillColor?: string };
  if (el.type === 'freehand' && isPenStroke(el)) {
    // A marker stroke's area is its ink: filled in its colour, an explicit one, else its pen
    // colour by name (Ink for one with none), which resolveStockColours fills in for each canvas.
    if (src.strokeColor) out.fillColor = src.strokeColor;
    else out.penColour = el.penColour ?? INK_PEN_COLOUR;
    out.strokeWidth = 'none';
  } else {
    // A shape, a path or a closed pencil stroke keeps its fill and its outline, a stock colour
    // by name included.
    if (src.penColour) out.penColour = src.penColour;
    if (src.fillColor) out.fillColor = src.fillColor;
    if (src.strokeColor) out.strokeColor = src.strokeColor;
    if (src.fillSwatch) out.fillSwatch = src.fillSwatch;
    if (src.strokeSwatch) out.strokeSwatch = src.strokeSwatch;
    if (src.strokeWidth) out.strokeWidth = src.strokeWidth;
    if (src.strokeStyle) out.strokeStyle = src.strokeStyle;
  }
  if (el.opacity !== undefined) out.opacity = el.opacity;
  if (el.layerId) out.layerId = el.layerId;
  return out;
}

/** The result as a path: its box wraps every contour, each contour's points corner nodes
 *  normalised to the box. Null when it holds nothing. */
export function multiPolygonToPath(
  shape: MultiPolygon,
  id: string,
  style: Partial<PathElement>,
): PathElement | 'empty' | 'too-detailed' {
  const rings = shape.flatMap((poly) => poly.map((r) => simplifyRing(r))).filter((r) => r.length);
  if (rings.length === 0) return 'empty';
  if (rings.reduce((n, r) => n + r.length, 0) > MAX_PATH_NODES) return 'too-detailed';
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rings)
    for (const [x, y] of r) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  const contour = (r: Ring): PathNode[] =>
    r.map(([x, y]) => ({
      nx: round((x - x0) / width),
      ny: round((y - y0) / height),
      mode: 'corner',
    }));
  const [first, ...rest] = rings.map(contour);
  return {
    ...style,
    id,
    type: 'path',
    x: x0,
    y: y0,
    width,
    height,
    closed: true,
    nodes: first!,
    ...(rest.length ? { subpaths: rest } : {}),
  };
}

/** Combine the elements (in their stacking order, bottom first) by `op`. */
export async function combineElements(
  ordered: readonly BoxedElement[],
  op: CombineOp,
  newId: string,
): Promise<CombineResult> {
  const refused = refusal(ordered);
  if (refused) return refused;
  let pc: Clipping;
  try {
    pc = await loadEngine();
  } catch (e) {
    console.warn('[combine] load failed', e);
    return { ok: false, reason: 'failed' };
  }
  return combineWith(pc, ordered, op, newId);
}

/** The same, at once, when the engine has already loaded (`preloadCombineEngine`); null while it
 *  has not. */
export function combineElementsNow(
  ordered: readonly BoxedElement[],
  op: CombineOp,
  newId: string,
): CombineResult | null {
  if (!loaded) return null;
  return refusal(ordered) ?? combineWith(loaded, ordered, op, newId);
}

// Why these elements cannot be combined, or null when they can be tried.
function refusal(ordered: readonly BoxedElement[]): CombineResult | null {
  if (ordered.length < 2 || !ordered.every(isCombinable))
    return { ok: false, reason: 'not-combinable' };
  const points = inputPoints(ordered);
  if (points > COMBINE_MAX_INPUT_POINTS) {
    console.warn(`[combine] too detailed: points=${points}`);
    return { ok: false, reason: 'too-detailed' };
  }
  return null;
}

const inputPoints = (els: readonly BoxedElement[]) =>
  els.reduce((n, el) => n + elementRings(el).reduce((m, r) => m + r.length, 0), 0);

function combineWith(
  pc: Clipping,
  ordered: readonly BoxedElement[],
  op: CombineOp,
  newId: string,
): CombineResult {
  const points = inputPoints(ordered);
  let shape: MultiPolygon;
  try {
    shape = runOp(
      pc,
      op,
      ordered.map((el) => elementArea(pc, el)),
    );
  } catch (e) {
    console.warn(`[combine] op failed: op=${op} elements=${ordered.length} points=${points}`, e);
    return { ok: false, reason: 'failed' };
  }
  const path = multiPolygonToPath(shape, newId, styleOf(ordered[0]!));
  if (path === 'empty' || path === 'too-detailed') {
    if (path === 'too-detailed')
      console.warn(`[combine] too detailed: result over ${MAX_PATH_NODES}`);
    return { ok: false, reason: path };
  }
  debugLog('[combine] combined', {
    op,
    elements: ordered.length,
    contours: 1 + (path.subpaths?.length ?? 0),
  });
  return { ok: true, path, removedIds: ordered.map((el) => el.id) };
}
