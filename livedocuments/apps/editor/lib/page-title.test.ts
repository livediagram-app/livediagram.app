import { describe, expect, it } from 'vitest';
import type { Element } from '@livedocuments/document';
import { PAGE_TITLE_MAX, pageTitleOf } from './page-title';

const text = (id: string, label: string, y: number, extra: Partial<Element> = {}): Element =>
  ({ id, type: 'text', x: 0, y, width: 200, height: 40, label, ...extra }) as Element;

describe('pageTitleOf: the name Contents gives an unnamed page', () => {
  it('takes the biggest words on the page', () => {
    expect(
      pageTitleOf([
        text('body', 'Some body copy', 0, { textSize: 'sm' }),
        text('title', 'Quarterly Review', 200, { textSize: 48 }),
      ]),
    ).toBe('Quarterly Review');
  });

  it('reads a scaled text at the size it draws', () => {
    expect(
      pageTitleOf([
        text('a', 'Medium', 0, { textSize: 'md' }),
        text('b', 'Scaled up', 100, { textSize: 'md', textScale: 3 }),
      ]),
    ).toBe('Scaled up');
  });

  it('takes the topmost where sizes tie, then the leftmost', () => {
    expect(pageTitleOf([text('low', 'Lower', 100), text('high', 'Higher', 10)])).toBe('Higher');
    expect(pageTitleOf([text('r', 'Right', 10, { x: 50 }), text('l', 'Left', 10, { x: 5 })])).toBe(
      'Left',
    );
  });

  it("takes a text's first line with words, its spaces tidied", () => {
    expect(pageTitleOf([text('t', '\n   Launch   Plan  \nsecond line', 0)])).toBe('Launch Plan');
  });

  it('cuts a long title short', () => {
    const title = pageTitleOf([text('t', 'x'.repeat(200), 0)]);
    expect(title).toHaveLength(PAGE_TITLE_MAX);
    expect(title?.endsWith('…')).toBe(true);
  });

  it('has none without words: no text, an empty one, only shapes', () => {
    expect(pageTitleOf([])).toBeUndefined();
    expect(pageTitleOf([text('t', '   \n ', 0), text('u', '', 0)])).toBeUndefined();
    expect(
      pageTitleOf([
        { id: 's', type: 'shape', x: 0, y: 0, width: 9, height: 9, label: 'Box' } as Element,
      ]),
    ).toBeUndefined();
  });

  it('reads a thousand texts in a few ms of CPU', () => {
    const many = Array.from({ length: 1000 }, (_, i) => text(`t${i}`, `Line ${i}`, i));
    const start = process.cpuUsage();
    expect(pageTitleOf(many)).toBe('Line 0');
    const { user, system } = process.cpuUsage(start);
    expect((user + system) / 1000).toBeLessThan(16);
  });
});
