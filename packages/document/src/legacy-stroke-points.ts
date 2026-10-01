// Loading strokes stored before packed points (docs/specs/006-document/stroke-points.md
// "Migration of stored strokes"). A freehand stored its points as `points: { nx, ny }[]` and a
// pen's pressures as `pressures: number[]`; both become one `packedPoints` block. This is the
// only reader of the former shape: it runs wherever a stored or foreign element arrives, before
// validation, so nothing downstream ever sees it.

import { encodeStrokePoints, type NormalisedPoint } from './stroke-points';
import type { Element, FreehandElement } from './index';

type LegacyFields = { points?: unknown; pressures?: unknown };

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function hasLegacyPoints(el: Element): boolean {
  return el.type === 'freehand' && ('points' in el || 'pressures' in el);
}

function legacySamples(
  rawPoints: unknown,
  rawPressures: unknown,
): { points: NormalisedPoint[]; pressures?: number[] } {
  const list = Array.isArray(rawPoints) ? (rawPoints as unknown[]) : [];
  const pressureList =
    Array.isArray(rawPressures) &&
    rawPressures.length === list.length &&
    rawPressures.every((p) => isFiniteNumber(p) && p >= 0 && p <= 1)
      ? (rawPressures as number[])
      : undefined;
  const points: NormalisedPoint[] = [];
  const pressures: number[] = [];
  list.forEach((p, i) => {
    const q = p as { nx?: unknown; ny?: unknown } | null;
    if (!q || typeof q !== 'object' || !isFiniteNumber(q.nx) || !isFiniteNumber(q.ny)) return;
    points.push({ nx: q.nx, ny: q.ny });
    if (pressureList) pressures.push(pressureList[i]!);
  });
  return pressureList ? { points, pressures } : { points };
}

// The box widened to every point, and the points renormalised into it, so none moves.
function fitBox(
  el: FreehandElement,
  points: NormalisedPoint[],
): { box: Pick<FreehandElement, 'x' | 'y' | 'width' | 'height'>; points: NormalisedPoint[] } {
  let minX = 0;
  let maxX = 1;
  let minY = 0;
  let maxY = 1;
  for (const p of points) {
    minX = Math.min(minX, p.nx);
    maxX = Math.max(maxX, p.nx);
    minY = Math.min(minY, p.ny);
    maxY = Math.max(maxY, p.ny);
  }
  const box = { x: el.x, y: el.y, width: el.width, height: el.height };
  if (minX === 0 && maxX === 1 && minY === 0 && maxY === 1) return { box, points };
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  return {
    box: {
      x: el.x + minX * el.width,
      y: el.y + minY * el.height,
      width: spanX * el.width,
      height: spanY * el.height,
    },
    points: points.map((p) => ({ nx: (p.nx - minX) / spanX, ny: (p.ny - minY) / spanY })),
  };
}

function migrateStroke(el: Element): Element {
  const {
    points: rawPoints,
    pressures: rawPressures,
    ...rest
  } = el as FreehandElement & LegacyFields;
  const stroke = rest as FreehandElement;
  if (typeof stroke.packedPoints === 'string') return stroke;
  const samples = legacySamples(rawPoints, rawPressures);
  const fitted = fitBox(stroke, samples.points);
  return {
    ...stroke,
    ...fitted.box,
    packedPoints: encodeStrokePoints(fitted.points, samples.pressures),
  };
}

export function migrateLegacyStrokePoints(elements: Element[]): Element[] {
  if (!elements.some(hasLegacyPoints)) return elements;
  let strokes = 0;
  const out = elements.map((el) => {
    if (!hasLegacyPoints(el)) return el;
    strokes++;
    return migrateStroke(el);
  });
  console.info('[stroke-points] migrated', { strokes });
  return out;
}
