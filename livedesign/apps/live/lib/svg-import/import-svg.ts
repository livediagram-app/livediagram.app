// SVG import (docs/specs/020-import-export/svg-import.md): SVG text to path elements landed in a box (the page's
// safe area), or the reason it must be placed as a picture instead. Parses only through parseInert; the document
// is read, never inserted. Every import is one `[svg-import]` log line.
import { parseInert } from '@liveworkspace/trusted-types';
import { BORDER_STROKE_PX, MAX_PATH_NODES, type PathElement } from '@livedesign/design';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { drawnToPath, nodeCount } from './build';
import { SVG_IMPORT_MAX_BYTES, SVG_OUTLINE_SLACK, SVG_RESCALE_FACTOR } from './constants';
import {
  contoursBox,
  lineTo,
  transformContour,
  type Box,
  type Contour,
  type Matrix,
} from './geometry';
import { evenOddMatchesNonzero, resolveNonzero, traceContour, type BooleanEngine } from './nonzero';
import { outlineStroke } from './outline-stroke';
import type { SvgImportReport } from './report';
import { lineStyleOf, walkSvg, viewportOf, type Drawn } from './walk';

export type SvgImportRoute = 'dialog' | 'drop' | 'paste';

/** Where the import lands, in canvas px. */
export type SvgLandingBox = { x: number; y: number; width: number; height: number };

export type SvgPictureReason = 'too-large' | 'too-many-elements' | 'too-detailed';

export type SvgImportResult =
  | {
      kind: 'shapes';
      paths: PathElement[];
      report: SvgImportReport;
      // Elements resolved nonzero through the engine, and strokes outlined (the log line's counts).
      made: { nonzero: number; outlined: number };
    }
  | { kind: 'picture'; reason: SvgPictureReason }
  | { kind: 'unreadable' }
  | { kind: 'empty'; report: SvgImportReport | null };

export type SvgImportDeps = {
  /** The boolean engine, loaded only when a nonzero fill needs resolving or a stroke outlining. */
  loadEngine: () => Promise<BooleanEngine>;
  newId?: () => string;
};

/** The file's size in UTF-8 bytes, stopping early once it is past the cap. */
function overByteCap(text: string): boolean {
  // Every character is at least one byte, so a text longer than the cap is over it without encoding.
  if (text.length > SVG_IMPORT_MAX_BYTES) return true;
  return new TextEncoder().encode(text).length > SVG_IMPORT_MAX_BYTES;
}

/** The drawn box: each element's curves, grown by half its stroke width when it is stroked (a stroke paints half its
 *  width either side of the line), in root units. */
export function drawnBox(drawn: readonly Drawn[]): Box | null {
  const out: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const d of drawn) {
    const b = contoursBox(d.contours);
    if (!b) continue;
    const g = d.stroke ? d.stroke.width / 2 : 0;
    out.x0 = Math.min(out.x0, b.x0 - g);
    out.y0 = Math.min(out.y0, b.y0 - g);
    out.x1 = Math.max(out.x1, b.x1 + g);
    out.y1 = Math.max(out.y1, b.y1 + g);
  }
  return Number.isFinite(out.x0) ? out : null;
}

/** Whether a stroke this wide (landed px) passes Extra thick, so it is outlined rather than snapped (D22). */
export function outlinesStroke(px: number): boolean {
  return px > BORDER_STROKE_PX['extra-thick'] * SVG_OUTLINE_SLACK;
}

// The uniform scale and offset that fit `box` into `into`, centred; null when the box has no size.
function fitMatrix(box: Box, into: SvgLandingBox): Matrix | null {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  if (!(w > 0) && !(h > 0)) return null;
  const s = Math.min(w > 0 ? into.width / w : Infinity, h > 0 ? into.height / h : Infinity);
  const tx = into.x + (into.width - w * s) / 2 - box.x0 * s;
  const ty = into.y + (into.height - h * s) / 2 - box.y0 * s;
  return [s, 0, 0, s, tx, ty];
}

// A resolved ring as a contour of straight segments.
function ringContour(ring: readonly [number, number][]): Contour {
  const pts = ring.map(([x, y]) => ({ x, y }));
  const segments = pts.map((p, i) => lineTo(p, pts[(i + 1) % pts.length]!));
  return { start: pts[0]!, segments, closed: true };
}

/** Brings SVG text in as path elements fitted into `into`. Never throws for a bad file. */
export async function importSvgText(
  text: string,
  into: SvgLandingBox,
  route: SvgImportRoute,
  deps: SvgImportDeps,
): Promise<SvgImportResult> {
  const result = await run(text, into, deps);
  const counts = result.kind === 'shapes' ? result.report : null;
  debugLog('[svg-import]', {
    route,
    outcome: result.kind,
    ...(result.kind === 'picture' ? { reason: result.reason } : {}),
    ...(result.kind === 'shapes'
      ? {
          paths: result.paths.length,
          nodes: result.paths.reduce((n, p) => n + nodeCount(p), 0),
          ...result.made,
        }
      : {}),
    ...(counts ? { report: counts } : {}),
  });
  return result;
}

async function run(
  text: string,
  into: SvgLandingBox,
  deps: SvgImportDeps,
): Promise<SvgImportResult> {
  if (overByteCap(text)) return { kind: 'picture', reason: 'too-large' };
  let root: Element;
  try {
    const doc = parseInert(text, 'image/svg+xml');
    root = doc.documentElement;
    if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0)
      return { kind: 'unreadable' };
  } catch {
    return { kind: 'unreadable' };
  }
  // A first guess at the landed scale (from the viewBox), so arcs are split finely enough; walked again when the
  // drawn content turns out to land much larger.
  const vp = viewportOf(root);
  let guess = Math.min(into.width / vp.width, into.height / vp.height);
  let walked = walkSvg(root, guess);
  if (!walked.ok) return { kind: 'picture', reason: walked.reason };
  let box = drawnBox(walked.drawn);
  let fit = box ? fitMatrix(box, into) : null;
  if (fit && fit[0] > guess * SVG_RESCALE_FACTOR) {
    guess = fit[0];
    walked = walkSvg(root, guess);
    // The same file walks the same way: only the arc precision changed.
    if (!walked.ok) return { kind: 'picture', reason: walked.reason };
    box = drawnBox(walked.drawn);
    fit = box ? fitMatrix(box, into) : null;
  }
  if (!fit) return { kind: 'empty', report: walked.report };
  const scale = fit[0];
  const newId = deps.newId ?? (() => crypto.randomUUID());
  let engine: BooleanEngine | null = null;
  const made = { nonzero: 0, outlined: 0 };
  const paths: PathElement[] = [];
  for (const d of walked.drawn) {
    const lines = d.contours.map((c) => transformContour(c, fit));
    let contours = lines;
    if (d.fill && d.fillRule === 'nonzero') {
      const rings = contours.map((c) => traceContour(c));
      if (!evenOddMatchesNonzero(rings)) {
        engine ??= await deps.loadEngine();
        const resolved = resolveNonzero(engine, rings);
        made.nonzero++;
        if (resolved.length) contours = resolved.map(ringContour);
      }
    }
    const stroke = d.stroke ? { ...d.stroke, width: d.stroke.width * scale } : null;
    const asStroke: Drawn = { ...d, contours, stroke };
    // A stroke past Extra thick becomes the filled area it paints, drawn from the element's own lines (a resolved
    // nonzero fill's rings are its fill, not its line), above the fill.
    let outline: PathElement | null = null;
    if (stroke && outlinesStroke(stroke.width)) {
      engine ??= await deps.loadEngine();
      const rings = outlineStroke(engine, lines, stroke.width, lineStyleOf(stroke));
      const area: Drawn | null = rings
        ? {
            ...d,
            contours: rings.map(ringContour),
            fill: { hex: stroke.hex, alpha: stroke.alpha },
            stroke: null,
            fillRule: 'evenodd',
          }
        : null;
      outline = area ? drawnToPath(area, newId()) : null;
      // Too detailed for one path, or the engine could not make it: the stroke stays a stroke.
      if (outline && nodeCount(outline) > MAX_PATH_NODES) outline = null;
      if (rings && rings.length === 0) {
        // A stroke that paints nothing (a butt-capped dot) leaves just the fill.
        outline = null;
        asStroke.stroke = null;
      }
    }
    const below = outline ? (d.fill ? { ...asStroke, stroke: null } : null) : asStroke;
    for (const path of [below ? drawnToPath(below, newId()) : null, outline]) {
      if (!path) continue;
      if (nodeCount(path) > MAX_PATH_NODES) return { kind: 'picture', reason: 'too-detailed' };
      paths.push(path);
    }
    if (outline) made.outlined++;
  }
  if (paths.length === 0) return { kind: 'empty', report: walked.report };
  return { kind: 'shapes', paths, report: walked.report, made };
}
