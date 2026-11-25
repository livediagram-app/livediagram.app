import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from '@liveworkspace/article/article-flow';
import { estimateArticle } from './article-layout-estimate';
import { newKnowledgebasePageContent, KNOWLEDGEBASE_FLOW } from './knowledgebase-page';
import { layOutPages, pagesOf } from './page';
import { drawsPageMetaRow, PAGE_META_ROW } from './page-meta-row';
import type { Tab } from './index';

// Work Tracker 1425: the estimate spaces blocks as app/article-pages.css does, its margins collapsing (the larger of a
// block's space below and the next one's space above stands between them), a list run's last item keeping a
// paragraph's space under it, and a zone its own 0.4 line above. Measured against Chromium laying the same blocks out
// with the stylesheet, a sent picture's zone landed within 0.2 px of the estimate.
const FLOW = KNOWLEDGEBASE_FLOW;
// A knowledgebase page's writing: 16 px text, 1.5 line spacing (a 24 px line), a paragraph's space 0.75 line.
const LINE = 24;
const PARA = 0.75 * LINE;

let n = 0;
const p = (text: string, style?: string): ArticleBlock =>
  ({
    id: `b${n++}`,
    type: 'paragraph',
    ...(style ? { style } : {}),
    runs: [{ text }],
  }) as ArticleBlock;
const li = (text: string, level = 0): ArticleBlock => ({
  id: `l${n++}`,
  type: 'list',
  list: 'bullet',
  level,
  runs: [{ text }],
});
const zone = (id: string): ArticleBlock => ({
  id,
  type: 'zone',
  zone: 'object',
  align: 'left',
  width: 300,
  height: 100,
});

const page = (blocks: ArticleBlock[]): Tab => {
  const content = newKnowledgebasePageContent();
  return {
    id: 't',
    name: 'T',
    elements: [],
    pages: content.pages,
    articles: { [FLOW]: { ...content.articles[FLOW], blocks } },
  };
};
const topOf = (blocks: ArticleBlock[], id = 'z') => {
  const tab = page(blocks);
  return estimateArticle(tab, FLOW, layOutPages(pagesOf(tab)), '#000000').zoneTops!.get(id)!;
};

describe('the estimate spaces blocks as the stylesheet does', () => {
  it('a zone after a paragraph sits a paragraph’s space under it, not that and its own margin too', () => {
    const one = topOf([p('A'), zone('z')]);
    const two = topOf([p('A'), p('B'), zone('z')]);
    expect(two - one).toBeCloseTo(LINE + PARA);
  });

  it('a list run’s last item keeps a paragraph’s space under it, the others a quarter line', () => {
    const list = topOf([li('A'), li('B'), zone('z')]);
    const para = topOf([p('A'), p('B'), zone('z')]);
    // Two lines either way; between the items a quarter line instead of a paragraph's space.
    expect(para - list).toBeCloseTo(PARA - 0.25 * LINE);
  });

  it('a section ending in a nested list and its arrows line keeps the zone below that line', () => {
    const items = [li('Checkout Flow'), ...Array.from({ length: 7 }, (_, i) => li(`Step ${i}`, 1))];
    const tab = page([p('Checkout Flow', 'h2'), ...items, p('6 arrows connect them.'), zone('z')]);
    const laid = layOutPages(pagesOf(tab));
    const est = estimateArticle(tab, FLOW, laid, '#000000');
    const arrows = [...est.ops.values()]
      .flat()
      .find((o) => o.k === 'text' && o.text === '6 arrows connect them.');
    if (arrows?.k !== 'text') throw new Error('no arrows line');
    // The line's box: 16 px text on a 24 px line, its baseline 0.8 of the text down from 4 px of half-leading.
    const lineBottom = arrows.y - 4 - 0.8 * 16 + LINE - laid[0]!.rect.y;
    expect(est.zoneTops!.get('z')! - lineBottom).toBeCloseTo(PARA);
  });

  it('a heading after a paragraph stands its own space above it, the paragraph’s space folded in', () => {
    const plain = topOf([p('A'), p('B'), zone('z')]);
    const headed = topOf([p('A'), p('B', 'h2'), zone('z')]);
    // An h2 is 22 px on a 1.25 line (27.5 px), a line above it (0.75 of it folded into the paragraph's space) and
    // 0.3 line under it, which the zone's 0.4 line above folds in.
    expect(headed - plain).toBeCloseTo(LINE - PARA + 27.5 + 0.4 * LINE - (LINE + PARA));
  });
});

// Round 3: a live knowledgebase page draws its meta row ("1 min read · Add Cover · Add Icon") under the Title, a
// direct child of the writing; the estimate leaves the same room, or every zone under it sat 48 px too high.
describe('the meta row under the Title', () => {
  // The Title: 40 px on a 1.15 line (46 px), half a line under it.
  const TITLE = 46;
  const services = (meta: boolean) => [
    p(meta ? 'Services' : '', 'title'),
    p('How the services fit together.'),
    p('Services', 'h2'),
    li('API'),
    li('Worker'),
    p('2 arrows connect them.'),
    zone('z'),
  ];

  it('is drawn under a Title on a page with words, and not on an empty one or without a Title', () => {
    expect(drawsPageMetaRow(services(true))).toBe(true);
    expect(drawsPageMetaRow([p('', 'title'), p('')])).toBe(false);
    expect(drawsPageMetaRow([p('Words')])).toBe(false);
    expect(drawsPageMetaRow([p('', 'title'), { id: 'c', type: 'code', text: 'npm test' }])).toBe(
      true,
    );
    expect(
      drawsPageMetaRow([
        p('', 'title'),
        {
          id: 't',
          type: 'table',
          rows: [{ id: 'r', cells: [[{ text: 'Cell' }]] }],
        } as unknown as ArticleBlock,
      ]),
    ).toBe(true);
    expect(drawsPageMetaRow([p('', 'title'), { id: 'd', type: 'divider' }])).toBe(false);
  });

  it('moves everything under it down by its height and its margins past the Title’s and the next block’s', () => {
    const withRow = topOf(services(true));
    // The page as the editor draws it: the Title, the meta row 0.5 line under it (its 8 px margin folded in), 28 px
    // tall, then 20 px, which the first paragraph's own space (none) leaves whole.
    const titleBottom = TITLE;
    const firstTop =
      titleBottom +
      Math.max(0.5 * LINE, PAGE_META_ROW.above) +
      PAGE_META_ROW.height +
      PAGE_META_ROW.below;
    // The rest as the plain page lays it: a paragraph, an h2 (a line above it), two items, the arrows line, the zone.
    const rest =
      LINE +
      PARA +
      (LINE - PARA) +
      27.5 +
      0.3 * LINE +
      LINE +
      0.25 * LINE +
      LINE +
      PARA +
      LINE +
      PARA;
    expect(withRow).toBeCloseTo(firstTop + rest + topOf([zone('z')]));
  });
});
