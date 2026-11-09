import { describe, expect, it } from 'vitest';
import { seededRandom } from '@liveworkspace/model-core/seeded-random';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS,
  arrowLabelPass,
  labelClaimGrid,
  layoutArrowLabel,
  layoutArrowLabels,
  type ArrowLabelLayout,
  type ArrowLabelLayoutOptions,
} from './arrow-label-layout';
import { arrowPolyline } from './arrow-path-hits';
import { createArrow, createPinnedArrow } from './factories';
import { elementIndexFor } from './geometry';
import { createShape } from './shape-factory';
import type { Element } from './index';

// docs/specs/008-canvas/canvas-performance.md "Arrow labels ask their neighbourhood": the label pass asks grids of
// the boxes and the placed labels, and gives exactly the places the scan over every box and label gave.

const measureFor: ArrowLabelLayoutOptions['measureFor'] = (px) => (s) => s.length * px * 0.5;
const options = { ...DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS, measureFor };
const WORDS = ['yes', 'no', 'maybe later', 'sends the order on', 'a much longer label that wraps'];

function randomBoard(seed: number, n: number): Element[] {
  const rand = seededRandom(seed);
  const at = () => Math.round((rand() - 0.2) * 1600);
  const boxes: Element[] = [];
  for (let i = 0; i < n; i++) {
    // A container (a stack, in every product) is no obstacle: labels sit over it.
    const container = rand() < 0.1;
    boxes.push({
      ...createShape('square', at(), at()),
      id: `b${i}`,
      ...(container ? { shape: 'stack' } : {}),
      ...(rand() < 0.3 ? { width: 40 + rand() * 300, height: 30 + rand() * 200 } : {}),
    });
  }
  const arrows: Element[] = [];
  for (let i = 0; i < n; i++) {
    const label = rand() < 0.8 ? WORDS[Math.floor(rand() * WORDS.length)] : undefined;
    const a =
      rand() < 0.7
        ? createPinnedArrow(
            `b${Math.floor(rand() * n)}`,
            'e',
            `b${Math.floor(rand() * n)}`,
            rand() < 0.5 ? 'w' : 'n',
          )
        : createArrow(at(), at(), at(), at());
    arrows.push({ ...a, id: `a${i}`, ...(label ? { label } : {}) });
  }
  // Interleaved, so labels see boxes painted before and after them.
  return boxes.flatMap((b, i) => [b, arrows[i]!]);
}

// The scan the grids replace: every placed label as a listed claim.
function scannedLayouts(elements: Element[]): Map<string, ArrowLabelLayout> {
  const claimed: { x: number; y: number; width: number; height: number }[] = [];
  const out = new Map<string, ArrowLabelLayout>();
  for (const el of elements) {
    if (el.type !== 'arrow' || !el.label) continue;
    const l = layoutArrowLabel(el, el.label, { elements, claimed, options });
    if (!l) continue;
    out.set(el.id, l);
    claimed.push(
      l.knockout ?? {
        x: l.center.x - l.width / 2,
        y: l.center.y - l.height / 2,
        width: l.width,
        height: l.height,
      },
    );
  }
  return out;
}

// The knockouts as the scan over every label gave them (arrowLabelPass's rule, restated).
function scannedKnockouts(elements: Element[], layouts: Map<string, ArrowLabelLayout>, id: string) {
  const index = elementIndexFor(elements);
  const pathOf = (aid: string) => {
    const el = index.get(aid);
    return el?.type === 'arrow' ? arrowPolyline(el, index) : [];
  };
  const runAt = (pts: { x: number; y: number }[], c: { x: number; y: number }) => {
    for (let k = 1; k < pts.length; k++) {
      const [a, b] = [pts[k - 1]!, pts[k]!];
      if (
        Math.abs(a.y - b.y) < 1 &&
        Math.abs(c.y - a.y) < 1 &&
        c.x >= Math.min(a.x, b.x) &&
        c.x <= Math.max(a.x, b.x)
      )
        return 'level';
      if (
        Math.abs(a.x - b.x) < 1 &&
        Math.abs(c.x - a.x) < 1 &&
        c.y >= Math.min(a.y, b.y) &&
        c.y <= Math.max(a.y, b.y)
      )
        return 'upright';
    }
    return null;
  };
  const own = layouts.get(id)?.knockout;
  const out = own ? [own] : [];
  for (const [other, l] of layouts) {
    if (other === id || !l.knockout) continue;
    const mine = runAt(pathOf(id), l.center);
    if (mine && mine === runAt(pathOf(other), l.center)) out.push(l.knockout);
  }
  return out;
}

describe('the arrow label pass by neighbourhood', () => {
  it('places every label exactly where the scan placed it, on random boards', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const elements = randomBoard(seed, 60);
      expect(layoutArrowLabels(elements, { measureFor })).toEqual(scannedLayouts(elements));
    }
  });

  it('cuts exactly the lines the scan cut, buses included', () => {
    // A bus: three arrows along one level track, each label on it, plus random boards.
    const bus: Element[] = [0, 1, 2].map((i) => ({
      ...createArrow(0, 100, 900, 100),
      id: `bus${i}`,
      label: `leg ${i}`,
    }));
    for (const elements of [bus, ...[3, 4, 5].map((s) => randomBoard(s, 60))]) {
      const pass = arrowLabelPass(elements, { measureFor });
      const layouts = new Map(pass.layouts);
      for (const el of elements)
        if (el.type === 'arrow')
          expect(pass.knockoutsOf(el.id)).toEqual(scannedKnockouts(elements, layouts, el.id));
    }
  });

  it('lays a draft out against every other label exactly as a listed claim would', () => {
    const elements = randomBoard(9, 60);
    const layouts = layoutArrowLabels(elements, { measureFor });
    const grid = labelClaimGrid(layouts);
    for (const el of elements) {
      if (el.type !== 'arrow') continue;
      const claimed = [...layouts]
        .filter(([other]) => other !== el.id)
        .map(
          ([, l]) =>
            l.knockout ?? {
              x: l.center.x - l.width / 2,
              y: l.center.y - l.height / 2,
              width: l.width,
              height: l.height,
            },
        );
      const draft = 'typed text';
      expect(
        layoutArrowLabel(el, draft, {
          elements,
          claimed: [],
          claimedGrid: { grid, except: el.id },
          options,
        }),
      ).toEqual(layoutArrowLabel(el, draft, { elements, claimed, options }));
    }
  });

  it('lays out 2,000 labelled arrows among 2,000 boxes within budget', () => {
    // A row-major grid of boxes, each joined to the next by a labelled arrow: 745 ms by the scan.
    const cols = 45;
    const elements: Element[] = [];
    for (let i = 0; i < 2000; i++) {
      elements.push({
        ...createShape('square', (i % cols) * 200, Math.floor(i / cols) * 140),
        id: `n${i}`,
      });
      if (i > 0)
        elements.push({
          ...createPinnedArrow(`n${i - 1}`, 'e', `n${i}`, 'w'),
          id: `a${i}`,
          label: 'yes',
        });
    }
    const ms = cpuMsOf(() => {
      const pass = arrowLabelPass(elements, { measureFor });
      for (const el of elements) if (el.type === 'arrow') pass.knockoutsOf(el.id);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});
