import { describe, expect, it } from 'vitest';
import { gateRun } from './reader-bench-gate';

// The detector gate under measurement (docs/research/vision/handwriting-readers.md):
// SmolVLM's answer is kept only where PP-OCRv6's text detector found at least
// one line of text in the same crop.
const note = (index: number, read: string, lines: string) => ({
  vlm: { wall: 'w', index, truth: 'Order placed', width: 100, height: 80, read, ms: 1 },
  det: { wall: 'w', index, truth: 'Order placed', width: 100, height: 80, read: lines, ms: 1 },
});

describe('gateRun', () => {
  it('keeps the answer where the detector found text', () => {
    const { vlm, det } = note(0, 'Order placed', '2');
    expect(gateRun([vlm], [det])[0]!.read).toBe('Order placed');
  });

  it('blanks the answer where the detector found none', () => {
    const { vlm, det } = note(0, 'Yes.', '0');
    expect(gateRun([vlm], [det])[0]!.read).toBe('');
  });

  it('pairs the two runs by note, not by position in the file', () => {
    const a = note(0, 'Order placed', '0');
    const b = note(1, 'Paid', '3');
    const gated = gateRun([a.vlm, b.vlm], [b.det, a.det]);
    expect(gated.map((r) => r.read)).toEqual(['', 'Paid']);
  });

  it('refuses runs that do not cover the same notes', () => {
    const a = note(0, 'Order placed', '1');
    const b = note(1, 'Paid', '1');
    expect(() => gateRun([a.vlm, b.vlm], [a.det])).toThrow(/w-1/);
  });
});
