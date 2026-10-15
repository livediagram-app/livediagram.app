import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livediagram/vitest-config/cpu-time';
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

// Untimed warm-up passes, then the fastest of a few timed ones. `cpuUsage` is the whole process, so
// while V8 is still compiling and collecting on its background threads a pass is billed for them: under
// coverage a pass that runs in 7 ms of wall time measured 30 ms of CPU, and on a CI runner the third
// pass still came in at 105 to 112 ms. Once warm it is 7 ms locally under coverage. The budget still
// sits far below what a quadratic routing pass would take on these sizes.
const WARM_UP_PASSES = 3;
const PASSES = 3;

function routeOnce(els: Element[]): void {
  const index = buildElementIndex(els);
  for (const el of els) if (el.type === 'arrow') finishArrowEnds(el, index, 'professional');
}

function routeAll(els: Element[]): number {
  for (let pass = 0; pass < WARM_UP_PASSES; pass++) routeOnce(els);
  let best = Infinity;
  for (let pass = 0; pass < PASSES; pass++)
    best = Math.min(
      best,
      cpuMsOf(() => routeOnce(els)),
    );
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
    expect(routeAll(els)).toBeLessThan(cpuBudgetMs(100));
  });

  it('routes a 1,000-deep chain in under 100 ms of CPU', () => {
    const els: Element[] = [node('n0', 0, 0)];
    for (let i = 1; i < 1000; i++) {
      els.push(node(`n${i}`, i * 314, i * 10, `n${i - 1}`), link(`n${i - 1}`, `n${i}`));
    }
    expect(routeAll(els)).toBeLessThan(cpuBudgetMs(100));
  });
});
