import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { lint, of, tabOf } from '../fixtures/build';

// LN text-overflow: on an Illustrate tab a text element's words fit its box, and no two texts print over each other.
const text = (id: string, x: number, y: number, label: string, extra: object = {}): Element =>
  ({ id, type: 'text', x, y, width: 200, height: 40, label, ...extra }) as Element;
const page = (...els: Element[]) => ({ ...tabOf(...els), opensIn: 'illustrate' as const });

describe('text-overflow', () => {
  it('names a page’s text that needs more lines than its box holds, with the height that holds it', () => {
    const long = text(
      't1',
      0,
      0,
      'A heading long enough to wrap onto three or more lines in its box',
      { textSize: 'lg' },
    );
    const found = of(lint(page(long)), 'text-overflow');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'warning', refs: [expect.any(String)] });
    expect(found[0]!.message).toMatch(/needs \d+ lines, holds 1$/);
    expect(found[0]!.fix).toMatch(/^set \S+ height=\d+$/);
  });

  it('names two texts printed over each other, and leaves those apart', () => {
    const found = of(
      lint(page(text('a', 0, 0, 'One'), text('b', 0, 8, 'Two'), text('c', 0, 300, 'Apart'))),
      'text-overflow',
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/prints over/);
    expect(found[0]!.fix).toMatch(/^move \S+ below:\S+$/);
  });

  it('judges where the lines are drawn: stacked lines that only touch pass, a wrapped line spilling onto the next does not', () => {
    const stacked = [0, 1, 2].map((i) =>
      text(`h${i}`, 0, i * 40, ['Keep pull', 'requests', 'small.'][i]!),
    );
    expect(of(lint(page(...stacked)), 'text-overflow')).toEqual([]);
    const spill = text('name', 0, 0, 'Crumb and Company Bakers of Fine Bread', {
      width: 160,
      height: 30,
      textSize: 'lg',
      textAlignY: 'top',
    });
    const tagline = text('tag', 0, 34, 'ARTISAN BAKERY', {
      width: 160,
      height: 24,
      textSize: 'sm',
    });
    expect(of(lint(page(spill, tagline)), 'text-overflow').map((f) => f.message)).toContainEqual(
      expect.stringMatching(/prints over/),
    );
  });

  it('leaves text on a curve out, drawn along its arc, not in its box', () => {
    const top = text('t', 0, 0, 'CRUMB AND CO.', { width: 400, height: 400, textArc: 180 });
    const bottom = text('b', 0, 0, 'ARTISAN BAKERY', { width: 400, height: 400, textArc: -180 });
    expect(of(lint(page(top, bottom)), 'text-overflow')).toEqual([]);
  });

  it('stays quiet on text that fits, set to scale, blank, or off an Illustrate tab', () => {
    const fits = text('f', 0, 0, 'Short');
    const scaled = text('s', 0, 100, 'A heading long enough to wrap onto three or more lines', {
      textSize: 'scale',
    });
    const blank = text('e', 0, 200, '  ');
    expect(of(lint(page(fits, scaled, blank)), 'text-overflow')).toEqual([]);
    const long = text(
      't1',
      0,
      0,
      'A heading long enough to wrap onto three or more lines in its box',
      { textSize: 'lg' },
    );
    expect(of(lint(tabOf(long)), 'text-overflow')).toEqual([]);
  });
});
