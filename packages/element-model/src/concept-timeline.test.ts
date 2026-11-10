import { describe, expect, it } from 'vitest';
import { timelineLayout } from './concept-timeline';

// docs/specs/009-elements/concept-graphics.md "Timeline"
describe('timelineLayout', () => {
  const l = timelineLayout(720, 240, 4);

  it('spaces the milestones evenly along the spine, short of its arrowhead, the spine through the middle', () => {
    const xs = l.milestones.map((m) => m.dot.x);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 6);
    expect(l.milestones.every((m) => m.dot.y === 120)).toBe(true);
    expect(l.spine.y).toBe(120);
    expect(l.head.tip.x).toBe(720);
    expect(xs.at(-1)!).toBeLessThan(720 - l.head.size);
  });

  it('takes turns above and below, each stem running from its dot out to its when, the name beyond', () => {
    expect(l.milestones.map((m) => m.above)).toEqual([true, false, true, false]);
    const [up, down] = l.milestones as [(typeof l.milestones)[0], (typeof l.milestones)[0]];
    expect(up.stem.y2).toBe(120 - l.dotR);
    expect(up.note.y + up.note.height).toBeLessThanOrEqual(up.stem.y1);
    expect(up.label.y + up.label.height).toBeLessThanOrEqual(up.note.y + 0.001);
    expect(down.stem.y1).toBe(120 + l.dotR);
    expect(down.note.y).toBeGreaterThanOrEqual(down.stem.y2);
    expect(down.label.y).toBeGreaterThanOrEqual(down.note.y + down.note.height - 0.001);
  });

  it('keeps every word inside the element, centred on its dot', () => {
    for (const m of l.milestones) {
      expect(m.label.x).toBeGreaterThanOrEqual(0);
      expect(m.label.x + m.label.width).toBeLessThanOrEqual(720 + 0.001);
      expect(m.label.y).toBeGreaterThanOrEqual(0);
      expect(m.label.y + m.label.height).toBeLessThanOrEqual(240 + 0.001);
      expect(m.label.x + m.label.width / 2).toBeCloseTo(m.dot.x, 6);
    }
  });

  it('stays whole when squeezed small or given one milestone', () => {
    const tiny = timelineLayout(120, 40, 8);
    expect(tiny.milestones).toHaveLength(8);
    expect(tiny.dotR).toBeGreaterThanOrEqual(5);
    for (const m of tiny.milestones) expect(m.label.height).toBeGreaterThanOrEqual(0);
    expect(timelineLayout(300, 120, 1).milestones[0]!.dot.x).toBeCloseTo((300 - 1.5 * 7.2) / 2, 6);
  });
});
