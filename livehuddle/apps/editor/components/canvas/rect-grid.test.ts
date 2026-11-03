import { describe, expect, it } from 'vitest';
import type { Rect } from '@livehuddle/document';
import { buildRectGrid, eachRectMeeting } from './rect-grid';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

const grid = buildRectGrid(
  new Map([
    ['near', r(10, 10, 50, 50)],
    ['far', r(5000, 5000, 50, 50)],
    // Wider than the cell cap: on the oversize list, which every usable query tests.
    ['huge', r(0, 0, 40_000, 40)],
    ['broken', r(Number.NaN, 0, 10, 10)],
  ]),
);

const meeting = (query: Rect, seen = new Set<string>()) => {
  const out: string[] = [];
  eachRectMeeting(grid, query, seen, (id) => out.push(id));
  return out.sort();
};

describe('the rect grid', () => {
  it('finds the rects a query meets, from its own cells and the oversize list', () => {
    expect(meeting(r(0, 0, 30, 30))).toEqual(['huge', 'near']);
    expect(meeting(r(4990, 4990, 20, 20))).toEqual(['far']);
    expect(meeting(r(900, 900, 10, 10))).toEqual([]);
  });

  it('walks the occupied cells for a query wider than them', () => {
    expect(meeting(r(-100_000, -100_000, 200_000, 200_000))).toEqual(['far', 'huge', 'near']);
    expect(meeting(r(4900, 4900, 100_000, 100_000))).toEqual(['far']);
  });

  it('reports each id once, skips what was seen, and ignores unusable rects', () => {
    const seen = new Set(['near']);
    expect(meeting(r(0, 0, 30, 30), seen)).toEqual(['huge']);
    expect(seen).toEqual(new Set(['near', 'huge']));
    expect(meeting(r(Number.NaN, 0, 10, 10))).toEqual([]);
    expect(meeting(r(0, 0, -1, 10))).toEqual([]);
  });
});
