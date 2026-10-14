import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { createShape, settleChips, type Element, type ShapeElement } from './index';

// docs/specs/009-elements/blueprints/badge.md "Performance and limits": settling runs on every commit and every tick
// (a drag landing, a nudge), so a large board with chips must settle inside a frame's slack. The worst case is every
// chip moved at once (each considered for attaching, a scan of every host): 2,000 boxes and 200 badges. Measured
// 2026-10-14 (CPU time, three warm runs): 11 to 17 ms with every badge moved, 0.5 to 1.3 ms for one badge's drag.
// Before the bounding-circle reject in nearestPoint the worst case took 106 ms.
function board(boxes: number, chips: number): Element[] {
  const els: Element[] = [];
  for (let i = 0; i < boxes; i++)
    els.push({
      ...(createShape('square', 0, 0) as ShapeElement),
      id: `h${i}`,
      x: (i % 50) * 200,
      y: Math.floor(i / 50) * 160,
    });
  for (let i = 0; i < chips; i++)
    els.push({
      ...(createShape('badge', 0, 0) as ShapeElement),
      id: `b${i}`,
      label: 'v2',
      x: (i % 50) * 200 + 90,
      y: Math.floor(i / 50) * 160 + 50,
      ...(i % 2 === 0 ? { attachedTo: `h${i}`, attachAt: 'top-right' as const } : {}),
    });
  return els;
}

describe('settleChips budget', () => {
  it('settles a 2,000-box board whose 200 badges all moved within 25 ms', () => {
    const prev = board(2000, 200);
    const next = prev.map((el) =>
      el.id.startsWith('b') ? { ...el, x: (el as ShapeElement).x + 5 } : el,
    );
    settleChips(prev, next); // warm
    const ms = Math.min(
      cpuMsOf(() => settleChips(prev, next)),
      cpuMsOf(() => settleChips(prev, next)),
    );
    expect(ms).toBeLessThan(25);
  });

  it('returns at once for a board with no chip', () => {
    const els = board(2000, 0);
    expect(settleChips(els, els)).toBe(els);
  });
});
