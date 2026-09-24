import { describe, expect, it } from 'vitest';
import type { Box } from './boxes';
import { findPads } from './pads';

// A pad of small notes on a wall of big ones (spec/139 Phase 9): too small
// for the wall's size floor, told apart from scraps by their siblings.

const sq = (x: number, y: number, s = 12, fill = 0.85): Box => ({
  classId: 1,
  x,
  y,
  w: s,
  h: s,
  pixels: Math.round(s * s * fill),
});
const FRAME = { width: 1000, height: 700 };
const NOTE = 40;

describe('findPads', () => {
  it('keeps a cluster of small like-sized squares', () => {
    const pad = [sq(100, 100), sq(125, 100), sq(150, 102), sq(100, 128)];
    expect(findPads(pad, [], FRAME, NOTE)).toHaveLength(4);
  });

  it('refuses a lone small square', () => {
    expect(findPads([sq(100, 100), sq(400, 400)], [], FRAME, NOTE)).toHaveLength(0);
  });

  it('refuses squares of very different sizes as siblings', () => {
    const mixed = [sq(100, 100, 8), sq(125, 100, 20), sq(160, 100, 8)];
    expect(findPads(mixed, [], FRAME, NOTE)).toHaveLength(0);
  });

  it('refuses strips, however many', () => {
    const strips = [0, 1, 2, 3].map((i) => ({ ...sq(100 + i * 25, 100), w: 30 }));
    expect(findPads(strips, [], FRAME, NOTE)).toHaveLength(0);
  });

  it('refuses boxes that are mostly holes', () => {
    const holes = [sq(100, 100, 12, 0.4), sq(125, 100, 12, 0.4), sq(150, 100, 12, 0.4)];
    expect(findPads(holes, [], FRAME, NOTE)).toHaveLength(0);
  });

  it('refuses boxes the frame clips', () => {
    const edge = [sq(100, 0), sq(125, 0), sq(150, 0)];
    expect(findPads(edge, [], FRAME, NOTE)).toHaveLength(0);
  });

  it('refuses boxes nearly the size of the wall’s notes', () => {
    const near = [sq(100, 100, 32), sq(140, 100, 32), sq(180, 100, 32)];
    expect(findPads(near, [], FRAME, NOTE)).toHaveLength(0);
  });

  it('refuses boxes lying over a note already kept', () => {
    const pad = [sq(100, 100), sq(125, 100), sq(150, 102), sq(175, 100)];
    const kept = [sq(90, 90, 24)];
    expect(findPads(pad, kept, FRAME, NOTE).map((b) => b.x)).toEqual([125, 150, 175]);
  });

  it('counts a box reported twice once', () => {
    const pad = [sq(100, 100), sq(100, 100), sq(125, 100)];
    expect(findPads(pad, [], FRAME, NOTE)).toHaveLength(0);
  });

  it('counts small notes already kept as siblings', () => {
    const kept = [sq(100, 100), sq(125, 100)];
    expect(findPads([sq(150, 100)], kept, FRAME, NOTE).map((b) => b.x)).toEqual([150]);
  });

  it('does not count the wall’s full-size notes as siblings', () => {
    const kept = [sq(100, 100, 40), sq(150, 100, 40)];
    expect(findPads([sq(200, 100, 14)], kept, FRAME, NOTE)).toHaveLength(0);
  });

  it('cuts two pad notes the close fused into a column, beside a pad', () => {
    const pad = [sq(100, 100), sq(125, 100), sq(150, 102)];
    const fused = { classId: 1, x: 175, y: 100, w: 13, h: 26, pixels: 13 * 26 * 0.85 };
    const out = findPads([...pad, fused], [], FRAME, NOTE);
    expect(out).toHaveLength(5);
    expect(out.filter((b) => b.x === 175).map((b) => [b.y, b.h])).toEqual([
      [100, 13],
      [113, 13],
    ]);
  });

  it('takes in a pad note whose only sibling is a fused note cut out of the pad', () => {
    const pad = [sq(100, 100), sq(125, 100), sq(150, 100)];
    const fused = { classId: 1, x: 175, y: 100, w: 13, h: 26, pixels: 13 * 26 * 0.85 };
    const below = sq(175, 150);
    const out = findPads([...pad, fused, below], [], FRAME, NOTE);
    expect(out).toHaveLength(6);
    expect(out).toContain(below);
  });

  it('still refuses a lone square far from every pad note', () => {
    const pad = [sq(100, 100), sq(125, 100), sq(150, 100)];
    const fused = { classId: 1, x: 175, y: 100, w: 13, h: 26, pixels: 13 * 26 * 0.85 };
    expect(findPads([...pad, fused, sq(175, 200)], [], FRAME, NOTE)).toHaveLength(5);
  });

  it('cuts nothing with no pad beside it: a strip of tape is not a row of notes', () => {
    const strip = { classId: 1, x: 175, y: 100, w: 39, h: 13, pixels: 39 * 13 * 0.9 };
    expect(findPads([strip], [], FRAME, NOTE)).toHaveLength(0);
  });

  it('does not cut a box barely longer than it is wide', () => {
    const pad = [sq(100, 100), sq(125, 100), sq(150, 102)];
    const tall = { classId: 1, x: 175, y: 100, w: 14, h: 22, pixels: 14 * 22 * 0.85 };
    expect(findPads([...pad, tall], [], FRAME, NOTE)).toHaveLength(3);
  });

  it('cuts a fused row by the size of the pad’s notes, not by its own height', () => {
    // Three 15px notes fused into a row 19px tall (they do not quite line
    // up): by its height it would be two notes, each holding one and a half.
    const pad = [sq(100, 100, 15), sq(125, 100, 15), sq(150, 102, 15)];
    const row = { classId: 1, x: 100, y: 125, w: 45, h: 19, pixels: 45 * 19 * 0.8 };
    const cut = findPads([...pad, row], [], FRAME, NOTE).filter((b) => b.y === 125);
    expect(cut.map((b) => [b.x, b.w])).toEqual([
      [100, 15],
      [115, 15],
      [130, 15],
    ]);
  });
});
