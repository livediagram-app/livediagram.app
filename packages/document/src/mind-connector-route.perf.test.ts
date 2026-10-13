import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { createPinnedArrow, createShape } from './factories';
import { buildElementIndex } from './geometry';
import { MIND_CONNECTOR_LOOK } from './mind-flow';
import { finishArrowEnds } from './mind-connector-route';
import type { ArrowElement, Element, ShapeElement } from './index';

// docs/specs/009-elements/mind-node.md "Connectors": routing every connector of a big map under
// Professional is one pass over the board per render (children and flows are indexed once), so a
// 2,000-node map, or a 1,000-deep chain, stays well inside a frame's budget.

const node = (id: string, x: number, y: number, parent?: string): ShapeElement => ({
  ...(createShape('mind-node', x, y) as ShapeElement),
  id,
  width: 250,
  height: 80,
  ...(parent ? { mindParentId: parent } : {}),
});

const link = (from: string, to: string): ArrowElement => ({
  ...createPinnedArrow(from, 'e', to, 'w'),
  id: `${from}-${to}`,
  ...MIND_CONNECTOR_LOOK,
});

// The fastest of a few passes, as the sketch budgets take: the first pass pays the JIT's warm-up,
// which on a CI runner under coverage cost 112 ms for work that runs in under 10 ms warm. The budget
// still sits far below what a quadratic routing pass would take on these sizes.
const PASSES = 3;

function routeAll(els: Element[]): number {
  let best = Infinity;
  for (let pass = 0; pass < PASSES; pass++) {
    const ms = cpuMsOf(() => {
      const index = buildElementIndex(els);
      for (const el of els) if (el.type === 'arrow') finishArrowEnds(el, index, 'professional');
    });
    best = Math.min(best, ms);
  }
  return best;
}

describe('mind connector routing cost', () => {
  it('routes a 2,000-node map in under 100 ms of CPU', () => {
    const els: Element[] = [node('root', 0, 0)];
    for (let b = 0; b < 40; b++) {
      els.push(node(`b${b}`, 314, b * 5000, 'root'), link('root', `b${b}`));
      for (let l = 0; l < 49; l++) {
        const id = `b${b}l${l}`;
        els.push(node(id, 628, b * 5000 + l * 98, `b${b}`), link(`b${b}`, id));
      }
    }
    expect(els.filter((e) => e.type === 'shape')).toHaveLength(1 + 40 * 50);
    expect(routeAll(els)).toBeLessThan(100);
  });

  it('routes a 1,000-deep chain in under 100 ms of CPU', () => {
    const els: Element[] = [node('n0', 0, 0)];
    for (let i = 1; i < 1000; i++) {
      els.push(node(`n${i}`, i * 314, i * 10, `n${i - 1}`), link(`n${i - 1}`, `n${i}`));
    }
    expect(routeAll(els)).toBeLessThan(100);
  });
});
