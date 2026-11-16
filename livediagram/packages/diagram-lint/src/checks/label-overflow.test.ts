import { describe, expect, it } from 'vitest';
import { labelBoxSize } from '@livediagram/document';
import { box, lint, of, tabOf } from '../fixtures/build';
import { labelParagraphs } from './label-overflow';

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

  it('measures a rich label by its runs: small detail lines under a title fit where the box size would not', () => {
    const runs = [
      { text: 'Totals', bold: true },
      { text: '\nLead time 27 d', size: 'sm' },
      { text: '\nFlow efficiency 13%', size: 'sm' },
      { text: '\nRolled 35%', size: 'sm' },
    ];
    const label = runs.map((r) => r.text).join('');
    const rich = box('a', 0, 0, { width: 220, height: 120, textSize: 'lg', label, richText: runs });
    expect(of(lint(tabOf(rich)), 'label-overflow')).toEqual([]);
    // The same words all at the box's size need more room than it has.
    const plain = box('a', 0, 0, { width: 220, height: 120, textSize: 'lg', label });
    expect(of(lint(tabOf(plain)), 'label-overflow')).toHaveLength(1);
    // Runs that only bold or colour carry no size, so the label measures as one block.
    expect(labelParagraphs('ab', [{ text: 'ab', bold: true }], 16, false)).toEqual([
      { text: 'ab', px: 16 },
    ]);
    // A break opening a run sizes the line after it, and a blank line keeps the label's own size.
    expect(
      labelParagraphs(
        'a\n\nb',
        [
          { text: 'a', size: 'sm' },
          { text: '\n\nb', size: 'lg' },
        ],
        16,
        false,
      ),
    ).toEqual([
      { text: 'a', px: 14 },
      { text: '', px: 16 },
      { text: 'b', px: 32 },
    ]);
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

describe('label-overflow on a card', () => {
  it('warns of a title or subtitle the render cuts short, with the card width that holds it', () => {
    const card = (width: number, extra: Record<string, unknown> = {}) =>
      box('c', 0, 0, {
        shape: 'card',
        width,
        height: 120,
        pageTitle: 'ElastiCache',
        pageSubtitle: 'Redis',
        label: 'Sessions',
        cardMedia: 'tile',
        ...extra,
      });
    const [f] = of(lint(tabOf(card(140))), 'label-overflow');
    expect(f).toMatchObject({ refs: ['c'], message: 'c title cut short' });
    const width = Number(/width=(\d+)/.exec(f!.fix)![1]);
    expect(of(lint(tabOf(card(width))), 'label-overflow')).toEqual([]);
    expect(of(lint(tabOf(card(400))), 'label-overflow')).toEqual([]);
    expect(of(lint(tabOf(card(140)), { source: 'graph' }), 'label-overflow')[0]!.fix).toBe(
      'shorten the title, or widen the card',
    );
    const both = of(
      lint(tabOf(card(120, { pageSubtitle: 'A subtitle far too long to fit' }))),
      'label-overflow',
    );
    expect(both[0]!.message).toBe('c title and subtitle cut short');
  });
});
