import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import { buildTemplate } from '@livehuddle/templates';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { buildLargeSelectionBoard } from '@/e2e/perf/large-selection-board';
import { tabBroadcastOps } from '@/app/document/[id]/tab-broadcast-ops';
import { withThemeApplied } from './tab-theme-apply';

// docs/specs/008-canvas/canvas-performance.md "A Tab Style change on a busy Space eases the canvas, not its parts": a
// theme pick is one pure transform of the tab and one room op, however big the Space. The worst case: the 1,770-element
// board (900 shapes, 870 captions) with eight Company Campus Spaces beside it, about 2,700 elements. Fastest of five
// after warm-up, in CPU time.

const campus = (copy: number): Element[] =>
  buildTemplate('company-campus', copy * 4000, 0).map((el) => ({ ...el, id: `${el.id}-c${copy}` }));

const TAB: Tab = {
  id: 't',
  name: 'Busy Space',
  elements: [
    ...buildLargeSelectionBoard(),
    ...Array.from({ length: 8 }, (_, i) => campus(i + 1)).flat(),
  ],
};

function pick(theme: string): { tab: Tab; opKinds: string[] } {
  const tab = withThemeApplied(TAB, theme, 'light');
  return { tab, opKinds: tabBroadcastOps(TAB, tab).map((op) => op.kind) };
}

function best(theme: string): number {
  for (let i = 0; i < 3; i++) pick(theme);
  let fastest = Infinity;
  for (let i = 0; i < 5; i++)
    fastest = Math.min(
      fastest,
      cpuMsOf(() => pick(theme)),
    );
  return fastest;
}

describe('a theme pick on a busy Space', () => {
  it('restyles the board as one whole-tab op', () => {
    expect(TAB.elements.length).toBeGreaterThan(2000);
    const { tab, opKinds } = pick('forest');
    expect(tab.theme).toBe('forest');
    expect(opKinds).toEqual(['tab']);
  });

  it('applies and derives its op within budget', () => {
    for (const theme of ['forest', 'midnight']) {
      const ms = best(theme);
      if (process.env.PERF_LOG)
        console.log(`theme pick ${theme}, ${TAB.elements.length} elements: ${ms.toFixed(1)} ms`);
      expect(ms).toBeLessThan(cpuBudgetMs(60));
    }
  });
});
