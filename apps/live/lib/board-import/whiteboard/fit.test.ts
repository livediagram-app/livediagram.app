import type { Element } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { buildStroke, fitToTab, type StrokeDraft } from './fit';

const wiggle = (n: number, amplitude: number): StrokeDraft => ({
  raw: Array.from({ length: n }, (_, i) => ({ x: i, y: Math.sin(i / 3) * amplitude })),
  closed: false,
  props: { strokeColor: '#000000' },
});

describe('buildStroke', () => {
  it('simplifies, normalises and rounds the points', () => {
    const el = buildStroke(wiggle(200, 0.05), 0.35);
    expect(el.type).toBe('freehand');
    expect(el.points.length).toBe(2);
    expect(el.strokeColor).toBe('#000000');
    for (const p of buildStroke(wiggle(200, 40), 0.35).points) {
      expect(String(p.nx).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
    }
  });
});

describe('fitToTab', () => {
  const other: Element = { id: 'n', type: 'text', x: 0, y: 0, width: 10, height: 10 } as Element;

  it('keeps full detail when the board fits', () => {
    const result = fitToTab([wiggle(300, 40), other], { bytesBudget: 1_000_000, maxElements: 100 });
    expect(result.ok && result.rounds).toBe(1);
    expect(result.ok && result.elements).toHaveLength(2);
  });

  it('simplifies further, round by round, until the board fits', () => {
    const drafts = Array.from({ length: 40 }, () => wiggle(400, 40));
    const full = fitToTab(drafts, { bytesBudget: 10_000_000, maxElements: 100 });
    if (!full.ok) throw new Error('should fit');
    const fullBytes = JSON.stringify(full.elements).length;
    const fitted = fitToTab(drafts, { bytesBudget: fullBytes * 0.6, maxElements: 100 });
    expect(fitted.ok && fitted.rounds).toBeGreaterThan(1);
    expect(fitted.ok && JSON.stringify(fitted.elements).length).toBeLessThanOrEqual(
      fullBytes * 0.6,
    );
  });

  it('refuses a board that cannot fit the bytes', () => {
    const drafts = Array.from({ length: 40 }, () => wiggle(400, 40));
    expect(fitToTab(drafts, { bytesBudget: 500, maxElements: 100 })).toEqual({ ok: false });
  });

  it('refuses a board with more elements than a tab holds', () => {
    expect(fitToTab([other, other, other], { bytesBudget: 1_000_000, maxElements: 2 })).toEqual({
      ok: false,
    });
  });
});
