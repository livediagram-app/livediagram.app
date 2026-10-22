import { describe, expect, it } from 'vitest';
import type { Element } from '@livedocuments/document';
import { lint, of, tabOf } from '../fixtures/build';

// LN text-overflow: a page's text element's words fit its box, and no two texts print over each other.
const text = (id: string, x: number, y: number, label: string, extra: object = {}): Element => ({
  id,
  type: 'text',
  x,
  y,
  width: 200,
  height: 40,
  label,
  ...extra,
});

describe('text-overflow', () => {
  it('names a page’s text that needs more lines than its box holds, with the height that holds it', () => {
    const long = text(
      't1',
      0,
      0,
      'A heading long enough to wrap onto three or more lines in its box',
      { textSize: 'lg' },
    );
    const found = of(lint(tabOf(long)), 'text-overflow');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'warning', refs: [expect.any(String)] });
    expect(found[0]!.message).toMatch(/needs \d+ lines, holds 1$/);
    expect(found[0]!.fix).toMatch(/^set \S+ height=\d+$/);
  });

  it('names two texts printed over each other, and leaves those apart', () => {
    const found = of(
      lint(tabOf(text('a', 0, 0, 'One'), text('b', 0, 8, 'Two'), text('c', 0, 300, 'Apart'))),
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
    expect(of(lint(tabOf(...stacked)), 'text-overflow')).toEqual([]);
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
    expect(of(lint(tabOf(spill, tagline)), 'text-overflow').map((f) => f.message)).toContainEqual(
      expect.stringMatching(/prints over/),
    );
  });

  it('names a word cut across lines, with the width that holds it', () => {
    const stat = text('n', 0, 0, '£4.6bn', { width: 70, height: 120, textSize: 'lg' });
    const found = of(lint(tabOf(stat)), 'text-overflow');
    expect(found.map((f) => f.message)).toEqual([
      expect.stringMatching(/breaks "£4\.6bn" across lines$/),
    ]);
    expect(found[0]!.fix).toMatch(/^set \S+ width=\d+$/);
  });

  it('leaves text on a curve out, drawn along its arc, not in its box', () => {
    const top = text('t', 0, 0, 'CRUMB AND CO.', { width: 400, height: 400, textArc: 180 });
    const bottom = text('b', 0, 0, 'ARTISAN BAKERY', { width: 400, height: 400, textArc: -180 });
    expect(of(lint(tabOf(top, bottom)), 'text-overflow')).toEqual([]);
  });

  it('names text printed over text, a heading wrapped onto its subtitle', () => {
    const heading = text('h', 0, 0, 'Smoother onboarding for every new team', {
      width: 280,
      height: 48,
      textSize: 'lg',
    });
    const subtitle = text('s', 0, 50, 'Get people to their first win fast', {
      width: 280,
      height: 24,
    });
    const found = of(lint(tabOf(heading, subtitle)), 'text-overflow');
    expect(found.map((f) => f.message)).toContainEqual(expect.stringMatching(/prints over/));
  });

  it('counts a wrapped heading’s descenders, which reach the foot of its last line', () => {
    // A heading wrapped in its box: "onboarding" hangs onto the subtitle under it.
    const heading = text('h', 764, 130, 'Smoother onboarding', {
      width: 280,
      height: 48,
      textSize: 'lg',
      textAlignX: 'left',
    });
    const subtitle = text('s', 764, 178, 'Get people to their first win fast', {
      width: 320,
      height: 28,
      textSize: 'sm',
      textAlignX: 'left',
    });
    expect(
      of(lint(tabOf(heading, subtitle)), 'text-overflow').map((f) => f.message),
    ).toContainEqual(expect.stringMatching(/prints over/));
    // On one line it clears the subtitle.
    expect(of(lint(tabOf({ ...heading, label: 'Onboarding' }, subtitle)), 'text-overflow')).toEqual(
      [],
    );
  });

  it('leaves turned text out, drawn across its box', () => {
    const axis = text('a', 0, 0, 'Likelihood', { width: 300, height: 30, rotation: -90 });
    const label = text('l', 0, 10, 'Possible');
    expect(of(lint(tabOf(axis, label)), 'text-overflow')).toEqual([]);
    expect(
      of(lint(tabOf({ ...axis, rotation: 0 } as Element, label)), 'text-overflow'),
    ).toHaveLength(1);
  });

  it('stays quiet on text that fits, set to scale, or blank', () => {
    const fits = text('f', 0, 0, 'Short');
    const scaled = text('s', 0, 100, 'A heading long enough to wrap onto three or more lines', {
      textSize: 'scale',
    });
    const blank = text('e', 0, 200, '  ');
    expect(of(lint(tabOf(fits, scaled, blank)), 'text-overflow')).toEqual([]);
  });
});
