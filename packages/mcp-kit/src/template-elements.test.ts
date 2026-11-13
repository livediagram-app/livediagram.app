import { describe, expect, it } from 'vitest';
import { templateAddOperations, type TemplateElementChecks } from './template-elements';

type Built = { ids: string[] };
const built: Built = { ids: ['a'] };
const box = { id: 'b', type: 'shape' };

const checks: TemplateElementChecks<Built> = {
  issue: (elements) => (elements.some((e) => (e as { bad?: true }).bad) ? 'bad value' : null),
  toOperations: (ops, tab) =>
    ops.some((o) => o.element.to === 'nowhere')
      ? `ops[1]: arrow "to" names nothing of ${tab.ids.join(',')}`
      : ops.map((o) => ({ op: 'add', element: o.element })),
};

describe('templateAddOperations', () => {
  it('makes one add operation per element', () => {
    expect(templateAddOperations([box], built, checks)).toEqual({
      operations: [{ op: 'add', element: box }],
    });
  });

  it('packs the elements first when the product packs strokes', () => {
    const packed = templateAddOperations([box], built, {
      ...checks,
      pack: (elements) => ({ elements: elements.map((e) => ({ ...(e as object), packed: true })) }),
    });
    expect(packed).toEqual({ operations: [{ op: 'add', element: { ...box, packed: true } }] });
  });

  it('answers what the packing refused', () => {
    expect(
      templateAddOperations([box], built, { ...checks, pack: () => ({ error: 'no points' }) }),
    ).toEqual({
      error: 'no points',
    });
  });

  it('answers a value issue', () => {
    expect(templateAddOperations([{ ...box, bad: true }], built, checks)).toEqual({
      error: 'bad value',
    });
  });

  it('names a refused op by its place in elements', () => {
    expect(templateAddOperations([{ ...box, to: 'nowhere' }], built, checks)).toEqual({
      error: 'elements[1]: arrow "to" names nothing of a',
    });
  });
});
