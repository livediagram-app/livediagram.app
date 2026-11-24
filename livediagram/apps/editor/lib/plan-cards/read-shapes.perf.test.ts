import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { makeAsk, makePreview } from './make-plan-rows';
import { planChangeOffers } from './plan-changes';
import { readPlanShapes } from './read-shapes';
import { arrow, box, lane } from './test-elements';

// make-plan-cards.md "Limits": a 500-shape tab with about 1,000 arrows across five lanes reads, previews and builds its
// ask in a few milliseconds; a drawn 500-card tab's offers too. Budgets are a shared runner's CPU time.
function tab(n = 500): Element[] {
  const out: Element[] = [];
  for (let l = 0; l < 5; l++)
    out.push(lane(`L${l}`, `Lane ${l}`, { x: 0, y: l * 1000, width: 20_000, height: 1000 }));
  for (let i = 0; i < n; i++) {
    out.push(
      box(`s${i}`, `Shape ${i} by 20 Dec`, {
        x: (i % 100) * 150,
        y: Math.floor(i / 100) * 1000 + 100,
      }),
    );
    if (i > 0) out.push(arrow(`a${i}`, `s${i - 1}`, `s${i}`));
    if (i > 1) out.push(arrow(`b${i}`, `s${i - 2}`, `s${i}`));
  }
  return out;
}

describe('a 500-shape tab', () => {
  it('reads, previews and asks in well under 300 ms', () => {
    const elements = tab();
    let links = 0;
    const ms = cpuMsOf(() => {
      const shapes = readPlanShapes(elements, { today: new Date(2026, 10, 24) });
      const ticked = new Set(shapes.map((s) => s.element));
      const preview = makePreview({
        shapes,
        ticked,
        laneMode: 'labels',
        columns: [],
        planId: 'P',
        tabId: 't',
        sends: [],
        removed: [],
      });
      makeAsk({
        shapes,
        ticked,
        removedTicked: new Set(),
        laneMode: 'labels',
        columns: [],
        board: 'b',
        column: 'To Do',
        source: { itemId: 'D', tabId: 't', label: 'x' },
      });
      links = preview.links;
    });
    expect(links).toBe(997);
    expect(ms).toBeLessThan(cpuBudgetMs(300));
  });

  it("finds a drawn 500-card tab's offers in well under 100 ms", () => {
    const drawn = tab().map((el) =>
      el.type === 'shape' && el.shape !== 'lane'
        ? { ...el, id: `card:L0:${el.id}` }
        : el.type === 'shape'
          ? { ...el, id: `lane:${el.id}` }
          : el,
    );
    const ms = cpuMsOf(() => planChangeOffers(drawn));
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
