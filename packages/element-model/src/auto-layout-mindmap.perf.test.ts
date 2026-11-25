import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuLeastMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { autoLayoutElements } from './auto-layout';
import { createPinnedArrow, createShape } from './testing/elements';
import type { Element } from './element';

// docs/specs/008-canvas/layout-cleanup.md "Layout styles": Mindmap. Each ring grows until no two of
// its nodes overlap where their wedges put them; that check looks only at the near neighbours that
// could still need more room, so a crowded ring stays about linear, never one look per pair.

// A hub with `branches` branches of `leaves` leaves each: one ring of `branches * leaves` nodes.
function star(branches: number, leaves: number): Element[] {
  const els: Element[] = [{ ...createShape('square', 0, 0), id: 'hub', width: 220, height: 70 }];
  let i = 0;
  const link = (from: string, to: string) => {
    els.push(
      { ...createShape('square', (i * 37) % 900, (i * 53) % 700), id: to, width: 220, height: 70 },
      { ...createPinnedArrow(from, 's', to, 'n'), id: `a${i++}` },
    );
  };
  for (let b = 0; b < branches; b++) {
    link('hub', `b${b}`);
    for (let l = 0; l < leaves; l++) link(`b${b}`, `b${b}l${l}`);
  }
  return els;
}

describe('mindmap ring clearance budget', () => {
  it('lays out a 3,000-node map (one ring of 2,970) within 60 ms of CPU', () => {
    const els = star(30, 99);
    for (let p = 0; p < 2; p++) autoLayoutElements(els, { style: 'mindmap' });
    expect(cpuLeastMsOf(() => autoLayoutElements(els, { style: 'mindmap' }))).toBeLessThan(
      cpuBudgetMs(60),
    );
  });
});
