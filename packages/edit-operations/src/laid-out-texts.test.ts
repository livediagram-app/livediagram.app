import { describe, expect, it } from 'vitest';
import {
  PAGE_TEXT_SAMPLE_MAX,
  PAGE_TEXTS_BUDGET,
  textsLeftOutLine,
  withLaidOutTexts,
} from './laid-out-texts';

// Each paged product's docs/specs/024-agents/pages-for-agents.md "A laid-out page's texts".

const refOf = (id: string) => `ref-${id}`;
const pages = [
  { id: 'p1', place: 1 },
  { id: 'p2', place: 2 },
  { id: 'p3', place: 3 },
];

describe('a laid-out page’s texts', () => {
  it('lists each text of a laid-out page by ref, slot and words, and leaves other pages alone', () => {
    const laid = new Map([
      [
        'p2',
        [
          { id: 'a', slot: 'title' },
          { id: 'b', slot: null },
          { id: 'gone', slot: 'body' },
          { id: 'pic', slot: 'body' },
        ],
      ],
    ]);
    const elements = [{ id: 'a', label: 'Why now' }, { id: 'b', label: '73%' }, { id: 'pic' }];
    expect(withLaidOutTexts(pages, laid, elements, refOf)).toEqual([
      { id: 'p1', place: 1 },
      {
        id: 'p2',
        place: 2,
        texts: [
          { ref: 'ref-a', slot: 'title', text: 'Why now' },
          { ref: 'ref-b', slot: null, text: '73%' },
        ],
      },
      { id: 'p3', place: 3 },
    ]);
  });

  it('cuts long words short with an ellipsis', () => {
    const long = 'x'.repeat(PAGE_TEXT_SAMPLE_MAX + 20);
    const [page] = withLaidOutTexts(
      [pages[0]!],
      new Map([['p1', [{ id: 'a', slot: 'body' }]]]),
      [{ id: 'a', label: long }],
      refOf,
    );
    expect(page!.texts![0]!.text).toBe(`${'x'.repeat(PAGE_TEXT_SAMPLE_MAX - 1)}…`);
    expect(page!.texts![0]!.text).toHaveLength(PAGE_TEXT_SAMPLE_MAX);
  });

  it('hands the pages back as they are when nothing was laid out', () => {
    expect(withLaidOutTexts(pages, undefined, [], refOf)).toEqual(pages);
    expect(withLaidOutTexts(pages, new Map(), [], refOf)).toEqual(pages);
  });

  it('stops listing at the budget, every later laid-out page with none, and says which', () => {
    // Each page's texts take about half the budget, so the first fits, the second does not.
    const label = 'y'.repeat(PAGE_TEXT_SAMPLE_MAX);
    const many = Array.from({ length: Math.ceil(PAGE_TEXTS_BUDGET / 2 / 110) }, (_, i) => ({
      id: `e${i}`,
      slot: 'body',
    }));
    const laid = new Map(pages.map((p) => [p.id, many]));
    const elements = many.map((s) => ({ id: s.id, label }));
    const out = withLaidOutTexts(pages, laid, elements, refOf);
    expect(out[0]!.texts).toHaveLength(many.length);
    expect(out[1]).toEqual(pages[1]);
    expect(out[2]).toEqual(pages[2]);
    expect(textsLeftOutLine(out, laid, 'the pages view')).toBe(
      'Texts of pages 2-3 are left out to keep this answer short: the pages view lists them.',
    );
    expect(textsLeftOutLine(out.slice(0, 2), laid, 'the pages view')).toBe(
      'Texts of page 2 are left out to keep this answer short: the pages view lists them.',
    );
  });

  it('says nothing when every laid-out page lists its texts', () => {
    expect(textsLeftOutLine([{ id: 'p1', place: 1, texts: [] }], new Map([['p1', []]]), 'v')).toBe(
      null,
    );
    expect(textsLeftOutLine(pages, undefined, 'v')).toBe(null);
  });
});
