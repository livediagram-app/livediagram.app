import { describe, expect, it } from 'vitest';
import {
  isDefaultPageName,
  isKnowledgebasePage,
  KNOWLEDGEBASE_FLOW,
  knowledgebasePage,
  NEW_PAGE_NAME,
  newKnowledgebasePageContent,
  START_PAGE_NAME,
  withKnowledgebasePage,
} from './knowledgebase-page';
import type { Element } from './element-union';
import type { Tab } from './tab-type';

const box = { id: 'a', type: 'shape' } as unknown as Element;

describe('a knowledgebase page', () => {
  it('is one article page holding its flow', () => {
    expect(knowledgebasePage()).toMatchObject({ kind: 'article', flow: KNOWLEDGEBASE_FLOW });
    expect(knowledgebasePage('art-9').flow).toBe('art-9');
  });

  it('starts with one page, an empty Title and a first paragraph', () => {
    const made = newKnowledgebasePageContent();
    expect(made.pages).toHaveLength(1);
    expect(made.articles[KNOWLEDGEBASE_FLOW]!.blocks.map((b) => b.type)).toEqual([
      'paragraph',
      'paragraph',
    ]);
    expect(isKnowledgebasePage(made)).toBe(true);
  });

  it('knows the names a page has before anyone names it', () => {
    for (const name of ['', '  ', START_PAGE_NAME, NEW_PAGE_NAME, 'Tab 3'])
      expect(isDefaultPageName(name)).toBe(true);
    expect(isDefaultPageName('Release Process')).toBe(false);
  });

  it('is not a tab without writing on a page of its own', () => {
    expect(isKnowledgebasePage({})).toBe(false);
    expect(isKnowledgebasePage({ pages: [knowledgebasePage()] })).toBe(false);
    expect(
      isKnowledgebasePage({ pages: [{ id: 'p', orientation: 'portrait', kind: 'slide' }] }),
    ).toBe(false);
  });

  it('reads an empty tab of no kind as a new page, and leaves any other tab alone', () => {
    const empty: Pick<Tab, 'elements' | 'pages' | 'articles'> = { elements: [] };
    expect(isKnowledgebasePage(withKnowledgebasePage(empty))).toBe(true);
    const drawn = { elements: [box] };
    expect(withKnowledgebasePage(drawn)).toBe(drawn);
    const slide = {
      elements: [],
      pages: [{ id: 'p', orientation: 'landscape' as const, kind: 'slide' as const }],
    };
    expect(withKnowledgebasePage(slide)).toBe(slide);
    const two = {
      elements: [],
      pages: [
        { id: 'p', orientation: 'portrait' as const },
        { id: 'q', orientation: 'portrait' as const },
      ],
    };
    expect(withKnowledgebasePage(two)).toBe(two);
  });
});
