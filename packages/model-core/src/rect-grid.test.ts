import { describe, expect, it } from 'vitest';
import { rectsIntersect, type Rect } from './geometry-primitives';
import { seededRandom } from './seeded-random';
import {
  addToRectGrid,
  anyRectMeeting,
  buildRectGrid,
  createRectGrid,
  eachRectMeeting,
} from './rect-grid';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

const grid = buildRectGrid(
  new Map([
    ['near', r(10, 10, 50, 50)],
    ['far', r(5000, 5000, 50, 50)],
    // Wider than the cell cap: on the always list, which every query tests.
    ['huge', r(0, 0, 40_000, 40)],
    ['broken', r(Number.NaN, 0, 10, 10)],
    // Negative width: no cell holds it, but rectsIntersect can still find it meeting a rect it spans.
    ['inverted', r(300, 300, -100, 20)],
  ]),
);

const meeting = (query: Rect, seen = new Set<string>()) => {
  const out: string[] = [];
  eachRectMeeting(grid, query, seen, (id) => out.push(id));
  return out.sort();
};

describe('the rect grid', () => {
  it('finds the rects a query meets, from its own cells and the always list', () => {
    expect(meeting(r(0, 0, 30, 30))).toEqual(['huge', 'near']);
    expect(meeting(r(4990, 4990, 20, 20))).toEqual(['far']);
    expect(meeting(r(900, 900, 10, 10))).toEqual([]);
    expect(meeting(r(150, 290, 400, 40))).toEqual(['inverted']);
  });

  it('walks the occupied cells for a query wider than them', () => {
    expect(meeting(r(-100_000, -100_000, 200_000, 200_000))).toEqual([
      'far',
      'huge',
      'inverted',
      'near',
    ]);
    expect(meeting(r(4900, 4900, 100_000, 100_000))).toEqual(['far']);
  });

  it('reports each id once and skips what was seen', () => {
    const seen = new Set(['near']);
    expect(meeting(r(0, 0, 30, 30), seen)).toEqual(['huge']);
    expect(seen).toEqual(new Set(['near', 'huge']));
  });

  it('tests every rect for a query no cell can hold', () => {
    expect(meeting(r(Number.NaN, 0, 10, 10))).toEqual([]);
    expect(meeting(r(0, 0, -1, 10))).toEqual([]);
    expect(anyRectMeeting(grid, r(Number.NaN, 0, 10, 10))).toBe(false);
    expect(anyRectMeeting(grid, r(5000, 5000, -1, 10))).toBe(false);
    // Negative size meeting a rect it spans, as rectsIntersect has it.
    expect(anyRectMeeting(grid, r(60, 20, -20, 10))).toBe(true);
  });

  it('answers whether anything but one id meets a query', () => {
    expect(anyRectMeeting(grid, r(4990, 4990, 20, 20))).toBe(true);
    expect(anyRectMeeting(grid, r(4990, 4990, 20, 20), 'far')).toBe(false);
    expect(anyRectMeeting(grid, r(900, 900, 10, 10))).toBe(false);
    expect(anyRectMeeting(grid, r(0, 0, 30, 30), 'near')).toBe(true);
    expect(anyRectMeeting(grid, r(4900, 4900, 100_000, 100_000))).toBe(true);
    expect(anyRectMeeting(grid, r(10_000_000, 10_000_000, 100_000, 100_000))).toBe(false);
    expect(anyRectMeeting(createRectGrid(), r(0, 0, 10, 10))).toBe(false);
  });

  it('keeps the first rect of an id added twice', () => {
    const g = createRectGrid();
    addToRectGrid(g, 'a', r(0, 0, 10, 10));
    addToRectGrid(g, 'a', r(1000, 1000, 10, 10));
    expect(anyRectMeeting(g, r(0, 0, 5, 5))).toBe(true);
    expect(anyRectMeeting(g, r(1000, 1000, 5, 5))).toBe(false);
  });

  it('gives exactly what testing every rect gives, on random boards', () => {
    const rand = seededRandom(7);
    const pick = (n: number) => (rand() - 0.3) * n;
    for (let round = 0; round < 40; round++) {
      const rects = new Map<string, Rect>();
      for (let i = 0; i < 120; i++) {
        const odd = rand() < 0.05;
        rects.set(
          `r${i}`,
          r(
            pick(4000),
            pick(4000),
            odd ? -pick(80) : rand() * (rand() < 0.1 ? 20_000 : 300),
            rand() * 300,
          ),
        );
      }
      const g = buildRectGrid(rects);
      for (let q = 0; q < 30; q++) {
        const query = r(
          pick(4000),
          pick(4000),
          rand() * (rand() < 0.1 ? 30_000 : 400),
          rand() * 400,
        );
        const expected = [...rects].filter(([, v]) => rectsIntersect(v, query)).map(([id]) => id);
        const got: string[] = [];
        eachRectMeeting(g, query, new Set(), (id) => got.push(id));
        expect(got.sort()).toEqual(expected.sort());
        expect(anyRectMeeting(g, query)).toBe(expected.length > 0);
      }
    }
  });
});
