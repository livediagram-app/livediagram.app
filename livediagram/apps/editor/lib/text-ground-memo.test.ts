import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  createShape,
  createText,
  textGroundOf,
  type BoxedElement,
  type Element,
} from '@livediagram/document';
import { textGroundMemo } from './text-ground-memo';

// docs/specs/004-interface-design/blueprints/colour-picker.md "Performance and limits".
const text = {
  ...createText(40, 40),
  id: 't',
  width: 120,
  height: 30,
  label: 'Hi',
} as BoxedElement;
const card = {
  ...createShape('square', 10, 10),
  id: 'card',
  width: 300,
  height: 200,
  fillColor: '#fef3c7',
} as Element;

describe('textGroundMemo', () => {
  it('reuses the ground while only the text colour changes, and works it out again when the canvas does', () => {
    const compute = vi.fn(textGroundOf);
    const memo = textGroundMemo(compute);
    expect(memo.batch()(text, { elements: [card, text] }, 'light')).toEqual({
      tones: ['#fef3c7'],
      on: 'card',
    });
    const recoloured = { ...text, textColor: '#ff0000' } as BoxedElement;
    memo.batch()(recoloured, { elements: [card, recoloured] }, 'light');
    expect(compute).toHaveBeenCalledTimes(1);
    const bare = memo.batch()(
      recoloured,
      { elements: [recoloured], backgroundColor: '#0f172a' },
      'light',
    );
    expect(bare).toEqual({ tones: ['#0f172a'], on: 'canvas' });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('answers a hover at 5,000 elements well inside a frame', () => {
    const many: Element[] = Array.from({ length: 5000 }, (_, i) => ({
      ...createShape('square', (i % 50) * 10, Math.floor(i / 50) * 10),
      id: `s${i}`,
    }));
    const memo = textGroundMemo();
    memo.batch()(text, { elements: [...many, text] }, 'light');
    let n = 0;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i += 1) {
        const recoloured = { ...text, textColor: i % 2 ? '#000000' : '#ff0000' } as BoxedElement;
        if (memo.batch()(recoloured, { elements: [...many, recoloured] }, 'light')) n += 1;
      }
    });
    expect(n).toBe(20);
    expect(ms / 20).toBeLessThan(cpuBudgetMs(2));
  });
});
