import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrateLegacyStrokePoints } from './legacy-stroke-points';
import { migrateStoredTab } from './stored-tab';
import {
  STROKE_POINT_MAX_ERROR,
  STROKE_PRESSURE_MAX_ERROR,
  parseStrokePoints,
} from './stroke-points';
import type { Element, FreehandElement } from './index';

type Legacy = Record<string, unknown>;

function legacyStroke(extra: Legacy = {}): Element {
  return {
    id: 's1',
    type: 'freehand',
    x: 100,
    y: 50,
    width: 200,
    height: 80,
    closed: false,
    points: [
      { nx: 0, ny: 0.25 },
      { nx: 0.5, ny: 1 },
      { nx: 1, ny: 0 },
    ],
    ...extra,
  } as unknown as Element;
}

function decoded(el: Element) {
  const parsed = parseStrokePoints((el as FreehandElement).packedPoints);
  if (!parsed.ok) throw new Error(parsed.rejection);
  return parsed.points;
}

afterEach(() => vi.restoreAllMocks());

describe('migrateLegacyStrokePoints', () => {
  it('packs { nx, ny } points and drops the former fields', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const [el] = migrateLegacyStrokePoints([legacyStroke()]);
    expect(el).not.toHaveProperty('points');
    expect(el).not.toHaveProperty('pressures');
    expect(el).toMatchObject({ x: 100, y: 50, width: 200, height: 80, closed: false });
    const pts = decoded(el!);
    expect([...pts.nx]).toEqual([0, 32768 / 65535, 1]);
    expect(pts.pressures).toBeNull();
  });

  it('packs the pressures with their points', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const [el] = migrateLegacyStrokePoints([legacyStroke({ pressures: [0.1, 0.5, 0.9] })]);
    const pts = decoded(el!);
    [0.1, 0.5, 0.9].forEach((p, i) =>
      expect(Math.abs(pts.pressures![i]! - p)).toBeLessThanOrEqual(STROKE_PRESSURE_MAX_ERROR),
    );
    expect(el).not.toHaveProperty('pressures');
  });

  it.each([
    ['of another length', [0.5]],
    ['out of range', [0.5, 2, 0.5]],
    ['not numbers', ['a', 'b', 'c']],
    ['not a list', 'heavy'],
  ])('drops pressures %s', (_why, pressures) => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const [el] = migrateLegacyStrokePoints([legacyStroke({ pressures })]);
    expect(decoded(el!).pressures).toBeNull();
    expect(el).not.toHaveProperty('pressures');
  });

  it('widens the box to points that lie outside it, so none moves', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const before = [
      { nx: -0.5, ny: 0 },
      { nx: 1, ny: 1.5 },
    ];
    const [el] = migrateLegacyStrokePoints([legacyStroke({ points: before })]);
    const f = el as FreehandElement;
    expect(f).toMatchObject({ x: 0, y: 50, width: 300, height: 120 });
    const pts = decoded(el!);
    const canvas = before.map((p) => ({ x: 100 + p.nx * 200, y: 50 + p.ny * 80 }));
    canvas.forEach((c, i) => {
      expect(Math.abs(f.x + pts.nx[i]! * f.width - c.x)).toBeLessThanOrEqual(
        f.width * STROKE_POINT_MAX_ERROR,
      );
      expect(Math.abs(f.y + pts.ny[i]! * f.height - c.y)).toBeLessThanOrEqual(
        f.height * STROKE_POINT_MAX_ERROR,
      );
    });
  });

  it('drops points that are not finite numbers, and their pressures', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const [el] = migrateLegacyStrokePoints([
      legacyStroke({
        points: [{ nx: 0, ny: 0 }, { nx: null, ny: 0 }, { nx: 1, ny: 1 }, 'junk'],
        pressures: [0.2, 0.4, 0.6, 0.8],
      }),
    ]);
    const pts = decoded(el!);
    expect(pts.count).toBe(2);
    expect(pts.pressures!.length).toBe(2);
    expect(Math.abs(pts.pressures![1]! - 0.6)).toBeLessThanOrEqual(STROKE_PRESSURE_MAX_ERROR);
  });

  it('packs an empty stroke', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const [el] = migrateLegacyStrokePoints([legacyStroke({ points: [] })]);
    expect((el as FreehandElement).packedPoints).toBe('AQA=');
  });

  it('keeps packedPoints over stray former fields', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const stroke = {
      ...legacyStroke(),
      packedPoints: 'AQA=',
      pressures: [1, 1, 1],
    } as unknown as Element;
    const [el] = migrateLegacyStrokePoints([stroke]);
    expect((el as FreehandElement).packedPoints).toBe('AQA=');
    expect(el).not.toHaveProperty('points');
    expect(el).not.toHaveProperty('pressures');
  });

  it('is idempotent and returns the same list when nothing is legacy', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const once = migrateLegacyStrokePoints([legacyStroke()]);
    expect(migrateLegacyStrokePoints(once)).toBe(once);
    const other = [{ id: 't', type: 'text', x: 0, y: 0, width: 1, height: 1 } as Element];
    expect(migrateLegacyStrokePoints(other)).toBe(other);
  });

  it('logs how many strokes it converted', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    migrateLegacyStrokePoints([legacyStroke(), legacyStroke({ id: 's2' })]);
    expect(info).toHaveBeenCalledWith('[stroke-points] migrated', { strokes: 2 });
  });
});

describe('migrateStoredTab', () => {
  it('packs legacy stroke points on the way in', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const tab = migrateStoredTab({ theme: 'default', elements: [legacyStroke()] });
    expect(typeof (tab.elements[0] as FreehandElement).packedPoints).toBe('string');
  });
});
