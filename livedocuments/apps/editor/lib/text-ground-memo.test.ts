import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  createArrow,
  createShape,
  createText,
  layOutPages,
  textGroundOf,
  type BoxedElement,
  type Element,
  type Page,
} from '@livedocuments/document';
import { textGroundMemo } from './text-ground-memo';

// docs/specs/004-interface-design/blueprints/colour-picker.md "Performance and limits".
const PAGE = { id: 'p', orientation: 'portrait' } as const;
const rect = layOutPages([PAGE])[0]!.rect;
const pages = [PAGE] as Page[];
const text = {
  ...createText(rect.x + 40, rect.y + 40),
  id: 't',
  width: 120,
  height: 30,
  label: 'Hi',
} as BoxedElement;
const card = {
  ...createShape('square', rect.x + 10, rect.y + 10),
  id: 'card',
  width: 300,
  height: 200,
  fillColor: '#fef3c7',
} as Element;
const far = { ...createShape('square', rect.x + 400, rect.y + 400), id: 'far' } as Element;
const tabOf = (elements: Element[], extra: object = {}) => ({
  elements,
  pages,
  layers: undefined,
  ...extra,
});

function setup() {
  const compute = vi.fn(textGroundOf);
  const memo = textGroundMemo(compute);
  const ground = (el: BoxedElement, tab: ReturnType<typeof tabOf>, surface = 'light' as const) =>
    memo.batch()(el, tab, surface);
  return { compute, ground, memo };
}

describe('textGroundMemo', () => {
  it('reuses the ground while only the text colour changes', () => {
    const { compute, ground } = setup();
    const first = ground(text, tabOf([card, text, far]));
    expect(first).toEqual({ tones: ['#fef3c7'], on: 'card' });
    const recoloured = { ...text, textColor: '#ff0000' } as BoxedElement;
    expect(
      ground(recoloured, tabOf([card, recoloured, { ...far, fillColor: '#000' } as Element])),
    ).toBe(first);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('works it out again when the text moves, a box under it changes, or the page, layers or canvas do', () => {
    const { compute, ground } = setup();
    const tab = tabOf([card, text]);
    ground(text, tab);
    const moved = { ...text, x: text.x + 1 };
    ground(moved, tabOf([card, moved]));
    expect(compute).toHaveBeenCalledTimes(2);
    const recard = { ...card, fillColor: '#0f172a' } as Element;
    expect(ground(moved, tabOf([recard, moved]))).toEqual({ tones: ['#0f172a'], on: 'card' });
    expect(compute).toHaveBeenCalledTimes(3);
    const tab2 = tabOf([recard, moved]);
    ground(moved, tab2);
    expect(compute).toHaveBeenCalledTimes(3);
    ground(moved, { ...tab2, pages: [...pages] });
    ground(moved, { ...tab2, layers: [] as never });
    ground(moved, tab2, 'dark' as never);
    expect(compute).toHaveBeenCalledTimes(6);
    // Brought in front of the card: the same boxes, but the text now sits over none of them.
    expect(ground(moved, tabOf([moved, recard]))!.on).toBe('page');
    expect(compute).toHaveBeenCalledTimes(7);
  });

  it('skips lines, and works it out again when the text gains a setting', () => {
    const { compute, ground } = setup();
    const line = { ...createArrow(0, 0, 10, 10), id: 'a' } as Element;
    const tab = tabOf([line, text]);
    ground(text, tab);
    ground(text, tab);
    expect(compute).toHaveBeenCalledTimes(1);
    const bolder = { ...text, textBold: true } as BoxedElement;
    ground(bolder, tabOf([line, bolder]));
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('keeps only the latest batch, so it never outgrows the selection', () => {
    const { compute, memo } = setup();
    const other = { ...text, id: 'o' };
    const tab = tabOf([text, other]);
    const one = memo.batch();
    one(text, tab, 'light');
    one(other, tab, 'light');
    // The same element twice in one batch is worked out once.
    one(other, tab, 'light');
    expect(compute).toHaveBeenCalledTimes(2);
    memo.batch()(text, tab, 'light');
    expect(compute).toHaveBeenCalledTimes(2);
    // `other` was not asked for in the batch before, so it is worked out again.
    memo.batch()(other, tab, 'light');
    expect(compute).toHaveBeenCalledTimes(3);
  });

  it('answers a hover at 5,000 elements well inside a frame', () => {
    const many: Element[] = Array.from({ length: 5000 }, (_, i) => ({
      ...createShape('square', rect.x + (i % 50) * 10, rect.y + Math.floor(i / 50) * 10),
      id: `s${i}`,
    }));
    const memo = textGroundMemo();
    const tab = tabOf([...many, text]);
    memo.batch()(text, tab, 'light');
    let n = 0;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i += 1) {
        const recoloured = { ...text, textColor: i % 2 ? '#000000' : '#ff0000' } as BoxedElement;
        if (memo.batch()(recoloured, tabOf([...many, recoloured]), 'light')) n += 1;
      }
    });
    expect(n).toBe(20);
    // 20 hovers; uncached, each walked the tab in paint order.
    expect(ms / 20).toBeLessThan(cpuBudgetMs(2));
  });
});
