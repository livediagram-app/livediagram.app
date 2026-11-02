import { describe, expect, it } from 'vitest';
import { noteSizeField } from './size-field';

const note = (x: number, y: number, size: number) => ({ x, y, w: size, h: size });

describe('noteSizeField', () => {
  it('reads the size of the notes near a point, not the wall median', () => {
    // Big notes on the left, a pad of small ones on the right, far apart
    // against the wall's note (35 px).
    const grid = (x0: number, pitch: number, size: number) =>
      [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => note(x0 + i * pitch, j * pitch, size)));
    const samples = [...grid(0, 52, 50), ...grid(900, 22, 20)];
    const field = noteSizeField(samples, 35);
    expect(field.sizeAt(77, 77)).toBe(50);
    expect(field.sizeAt(932, 32)).toBe(20);
  });

  it('weighs near notes over far ones', () => {
    // Three small notes close by, five big ones a few notes away.
    const samples = [
      ...[0, 1, 2].map((i) => note(i * 22, 0, 20)),
      ...[0, 1, 2, 3, 4].map((i) => note(150 + i * 45, 0, 40)),
    ];
    expect(noteSizeField(samples, 40).sizeAt(30, 10)).toBe(20);
  });

  it('takes the median, so one odd blob does not move it', () => {
    const samples = [note(0, 0, 40), note(50, 0, 40), note(100, 0, 12), note(150, 0, 40)];
    expect(noteSizeField(samples, 40).sizeAt(75, 20)).toBe(40);
  });

  it('keeps within half and twice the wall size', () => {
    const small = [0, 1, 2, 3].map((i) => note(i * 12, 0, 10));
    expect(noteSizeField(small, 40).sizeAt(20, 5)).toBe(20);
    const big = [0, 1, 2, 3].map((i) => note(i * 20, 0, 95));
    expect(noteSizeField(big, 40).sizeAt(77, 47)).toBe(80);
  });

  it('answers the wall size where too few notes are near to read', () => {
    const samples = [note(0, 0, 20), note(25, 0, 20), note(2000, 0, 40)];
    expect(noteSizeField(samples, 40).sizeAt(10, 10)).toBe(40);
  });

  it('answers the wall size when the wall has none', () => {
    expect(noteSizeField([note(0, 0, 20)], 0).sizeAt(0, 0)).toBe(0);
  });
});
