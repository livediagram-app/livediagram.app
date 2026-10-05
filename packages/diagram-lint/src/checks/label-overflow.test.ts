import { describe, expect, it } from 'vitest';
import { labelBoxSize } from '@livediagram/document';
import { box, lint, of, tabOf } from '../fixtures/build';

describe('label-overflow', () => {
  it('fires when a label needs more lines than its box holds', () => {
    const long = box('a', 0, 0, {
      label: 'An extremely long label that cannot possibly fit in this small box',
      textSize: 'md',
    });
    const [f] = of(lint(tabOf(long)), 'label-overflow');
    expect(f!.message).toMatch(/^a needs \d+ lines, holds \d+$/);
    expect(f!.fix).toBe('set a text=sm');
    const small = box('b', 0, 0, {
      label: 'An extremely long label that cannot possibly fit in this small box',
    });
    expect(of(lint(tabOf(small)), 'label-overflow')[0]!.fix).toBe(
      'set b label="<text>" note="<text>"',
    );
    expect(of(lint(tabOf(small), { source: 'graph' }), 'label-overflow')[0]!.fix).toBe(
      'shorten the label; detail goes in note',
    );
  });

  it('stays quiet for a fitting label, a blank one, a scaled one, and a shape that draws its own text (N11)', () => {
    expect(of(lint(tabOf(box('a', 0, 0, { label: 'Fits' }))), 'label-overflow')).toEqual([]);
    expect(of(lint(tabOf(box('a', 0, 0, { label: '  ' }))), 'label-overflow')).toEqual([]);
    const long = 'An extremely long label that cannot possibly fit in this small box';
    expect(
      of(lint(tabOf(box('a', 0, 0, { label: long, textSize: 'scale' }))), 'label-overflow'),
    ).toEqual([]);
    expect(
      of(lint(tabOf(box('a', 0, 0, { label: long, shape: 'pie-chart' }))), 'label-overflow'),
    ).toEqual([]);
    expect(of(lint(tabOf(box('a', 0, 0, { label: undefined }))), 'label-overflow')).toEqual([]);
  });

  it('never fires on a box sized for its label, as graph authoring sizes it', () => {
    const corpus = [
      'Orders',
      'Payments service',
      'Inventory service with cache',
      'A heading of forty characters, not more',
    ];
    for (const label of corpus) {
      const size = labelBoxSize(label, 'square');
      expect(of(lint(tabOf(box('a', 0, 0, { label, ...size }))), 'label-overflow')).toEqual([]);
    }
  });
});
