import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { descriptionFromMarkdown } from './rich-text-markdown';
import { normaliseRichRuns } from './rich-text-field';
import { ITEM_DESCRIPTION_MAX } from './limits';

// docs/specs/026-plan/plan-agents.md "Naming things as people do": a description as Markdown.
describe('descriptionFromMarkdown', () => {
  it('keeps text with nothing marked plain, with no runs', () => {
    expect(descriptionFromMarkdown('Just words.\nTwo lines, 2 * 3 = 6, snake_case_name')).toEqual({
      plain: 'Just words.\nTwo lines, 2 * 3 = 6, snake_case_name',
    });
  });

  it('reads headings and bullets as line marks', () => {
    const { plain, runs } = descriptionFromMarkdown(
      '# One\n## Two\n### Three\n#### Four\n- a\n  * b\n+ c',
    );
    expect(plain).toBe('One\nTwo\nThree\nFour\n• a\n  • b\n• c');
    expect(runs).toEqual([
      { text: 'One\n', heading: 1 },
      { text: 'Two\n', heading: 2 },
      { text: 'Three\nFour\n', heading: 3 },
      { text: '• a\n  • b\n• c' },
    ]);
  });

  it('reads bold, italic, strikethrough and links inline', () => {
    const { plain, runs } = descriptionFromMarkdown(
      '**B** __b__ *i* _i_ ~~s~~ [t](https://x.dev) [m](mailto:a@b.co)',
    );
    expect(plain).toBe('B b i i s t m');
    expect(runs).toEqual([
      { text: 'B', bold: true },
      { text: ' ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'i', italic: true },
      { text: ' ' },
      { text: 'i', italic: true },
      { text: ' ' },
      { text: 's', strikethrough: true },
      { text: ' ' },
      { text: 't', link: 'https://x.dev' },
      { text: ' ' },
      { text: 'm', link: 'mailto:a@b.co' },
    ]);
  });

  it('nests marks and keeps a heading through them', () => {
    expect(descriptionFromMarkdown('## A **b *c***').runs).toEqual([
      { text: 'A ', heading: 2 },
      { text: 'b ', heading: 2, bold: true },
      { text: 'c', heading: 2, bold: true, italic: true },
    ]);
  });

  it('keeps an unsafe link as its text, drops backticks, and honours escapes', () => {
    const { plain, runs } = descriptionFromMarkdown(
      '[x](javascript:alert(1)) `a*b*` \\*not\\* **y**',
    );
    expect(plain).toBe('x) a*b* *not* y');
    expect(runs).toEqual([{ text: 'x) a*b* *not* ' }, { text: 'y', bold: true }]);
  });

  it('leaves a delimiter with nothing to close it, or none to open, as text', () => {
    expect(descriptionFromMarkdown('**open, a ** b, x_y_ and `lone and \\q').plain).toBe(
      '**open, a ** b, x_y_ and `lone and \\q',
    );
    expect(descriptionFromMarkdown('[x] and [y](no space)')).toEqual({
      plain: '[x] and [y](no space)',
    });
    expect(descriptionFromMarkdown('*a *b* c*').runs).toEqual([
      { text: 'a *b', italic: true },
      { text: ' c*' },
    ]);
    expect(descriptionFromMarkdown('_a_b_ c').runs).toEqual([
      { text: 'a_b', italic: true },
      { text: ' c' },
    ]);
  });

  it('reads Windows line ends and makes runs the item store keeps', () => {
    const { plain, runs } = descriptionFromMarkdown('## T\r\n**b**\r\n\r\nend');
    expect(plain).toBe('T\nb\n\nend');
    expect(normaliseRichRuns(runs)).toEqual(runs);
  });

  // A line of marks with nothing to close them once took ~190ms at the description limit (each opener scanned
  // the rest of the line); linear now, about 3ms. Timed in CPU time (cpuMsOf), so a busy machine does not fail it.
  it('stays linear on a full-length line of unclosed marks', () => {
    const n = ITEM_DESCRIPTION_MAX;
    const worst = ['_a ', '*a ', '**a ', '[a ', '`a '].map((m) =>
      m.repeat(Math.floor(n / m.length)),
    );
    const ms = cpuMsOf(() => {
      for (const line of worst) descriptionFromMarkdown(line);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
