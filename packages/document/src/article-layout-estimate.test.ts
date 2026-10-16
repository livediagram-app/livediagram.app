import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from './article-flow';
import {
  ARTICLE_ESTIMATE_PAGES_MAX,
  estimateArticle,
  wrapEstimated,
} from './article-layout-estimate';
import { pagesWithWriting, renderPagesToSvg } from './svg-render-pages';
import { layOutIllustratePages, illustratePagesOf } from './illustrate-page';
import type { Tab } from './index';

// docs/specs/015-api/mcp-server.md §5: an article page's writing estimated without a browser, set as
// app/article-pages.css sets it and flowed down the article's pages.
const p = (text: string, style?: string, align?: string): ArticleBlock =>
  ({
    id: `b${Math.random()}`,
    type: 'paragraph',
    ...(style ? { style } : {}),
    ...(align ? { align } : {}),
    runs: [{ text }],
  }) as ArticleBlock;
const li = (
  text: string,
  list: 'bullet' | 'numbered' | 'todo',
  extra: object = {},
): ArticleBlock => ({ id: `l${Math.random()}`, type: 'list', list, runs: [{ text }], ...extra });

function article(
  blocks: ArticleBlock[],
  opts: { pages?: number; style?: object; fill?: object } = {},
): Tab {
  const pages = Array.from({ length: opts.pages ?? 1 }, (_, i) => ({
    id: `a${i + 1}`,
    orientation: 'portrait',
    size: 'a4',
    kind: 'article',
    flow: 'f',
    ...(opts.fill ? { background: { fill: opts.fill } } : {}),
  }));
  return {
    id: 't',
    name: 'T',
    opensIn: 'illustrate',
    pages,
    articles: { f: { blocks, ...(opts.style ? { style: opts.style } : {}) } },
    elements: [],
  } as unknown as Tab;
}

const laid = (tab: Tab) => layOutIllustratePages(illustratePagesOf(tab));
const texts = (ops: ReturnType<typeof estimateArticle>['ops'], id: string) =>
  (ops.get(id) ?? []).flatMap((o) => (o.k === 'text' ? [o.text] : []));

describe('wrapping without a browser', () => {
  it('breaks at words, keeps line breaks, and cuts a word longer than the line', () => {
    expect(wrapEstimated('one two three four', 10 * 0.52 * 16, 16, false)).toEqual([
      'one two',
      'three four',
    ]);
    expect(wrapEstimated('a\nb', 1000, 16, true)).toEqual(['a', 'b']);
    expect(wrapEstimated('abcdefghij', 4 * 0.52 * 16, 16, false)).toEqual(['abcd', 'efgh', 'ij']);
  });
});

describe('an article estimated', () => {
  it('sets every kind of block, in its style and the page’s ink', () => {
    const blocks: ArticleBlock[] = [
      p('Report', 'title'),
      p('Q3', 'subtitle'),
      p('Highlights', 'h1'),
      p('Detail', 'h2'),
      p('Small', 'h3'),
      p('Body text', undefined, 'center'),
      p('Right', undefined, 'right'),
      p('A quote', 'quote'),
      li('First', 'bullet'),
      li('One', 'numbered'),
      li('Done', 'todo', { checked: true }),
      li('Bold', 'bullet'),
      { id: 'c', type: 'code', text: 'npm test' },
      { id: 'd', type: 'divider' },
      { id: 'z', type: 'zone', zone: 'object', width: 100, height: 120 },
    ];
    (blocks[11] as { runs: object[] }).runs = [{ text: 'Bold', b: true }];
    const tab = article(blocks, {
      style: { look: 'report', accentHeadings: true, rules: 'headings', headingFont: 'poppins' },
    });
    const est = estimateArticle(tab, 'f', laid(tab), '#0369a1');
    expect(est).toMatchObject({ pagesUsed: 1, added: [], overflows: false });
    const ops = est.ops.get('a1')!;
    expect(texts(est.ops, 'a1')).toEqual(
      expect.arrayContaining([
        'Report',
        'Q3',
        'Highlights',
        'Body text',
        'A quote',
        '•',
        '1.',
        'npm test',
        'Bold',
      ]),
    );
    const title = ops.find((o) => o.k === 'text' && o.text === 'Report')!;
    expect(title).toMatchObject({ size: 36, weight: '700', color: '#0369a1' });
    expect(ops.find((o) => o.k === 'text' && o.text === 'Body text')).toMatchObject({
      anchor: 'middle',
    });
    expect(ops.find((o) => o.k === 'text' && o.text === 'Right')).toMatchObject({ anchor: 'end' });
    expect(ops.find((o) => o.k === 'text' && o.text === 'Bold')).toMatchObject({ weight: '700' });
    expect(ops.find((o) => o.k === 'text' && o.text === 'npm test')).toMatchObject({
      family: expect.stringContaining('Mono'),
    });
    expect(ops.some((o) => o.k === 'check' && o.done)).toBe(true);
    expect(ops.filter((o) => o.k === 'line').length).toBeGreaterThanOrEqual(4);
    expect(ops.filter((o) => o.k === 'rect').length).toBe(2);
  });

  it('draws a line of several styles as one text of its stretches, and a line of one style plainly', () => {
    const mixed = {
      id: 'm',
      type: 'paragraph',
      runs: [{ text: 'Lead: ', b: true }, { text: 'the rest ' }, { text: 'leans', i: true }],
    } as ArticleBlock;
    const tab = article([mixed, p('Plain')]);
    const texts = estimateArticle(tab, 'f', laid(tab), '#000000')
      .ops.get('a1')!
      .filter((o) => o.k === 'text');
    expect(texts[0]).toMatchObject({
      text: 'Lead: the rest leans',
      runs: [
        { text: 'Lead: ', weight: '700', style: 'normal' },
        { text: 'the rest ', weight: '400', style: 'normal' },
        { text: 'leans', weight: '400', style: 'italic' },
      ],
    });
    expect(texts[1]).not.toHaveProperty('runs');
  });

  it('keeps a heading with what follows it, starting the next page rather than ending one', () => {
    const fill = Array.from({ length: 20 }, (_, i) => p(`Line ${i + 1}`));
    const tab = article([...fill, p('Next quarter', 'h1'), p('After it')], { pages: 2 });
    const est = estimateArticle(tab, 'f', laid(tab), '#000000');
    expect(texts(est.ops, 'a1')).not.toContain('Next quarter');
    expect(texts(est.ops, 'a2').slice(0, 2)).toEqual(['Next quarter', 'After it']);
  });

  it('inks the writing light on a dark page', () => {
    const tab = article([p('Night')], { fill: { kind: 'solid', color: '#0f172a' } });
    const op = estimateArticle(tab, 'f', laid(tab), '#38bdf8').ops.get('a1')![0]!;
    expect(op).toMatchObject({ color: '#e2e8f0' });
  });

  it('flows onto its next page, starts one at a page break, and adds the pages the editor would', () => {
    const long = Array.from({ length: 80 }, (_, i) =>
      p(`Paragraph ${i + 1} with some words in it to wrap.`),
    );
    const two = article([p('Start'), { id: 'pb', type: 'pageBreak' }, p('After')], { pages: 2 });
    const t = estimateArticle(two, 'f', laid(two), '#000000');
    expect(texts(t.ops, 'a2')).toEqual(['After']);
    const grown = article(long);
    const est = estimateArticle(grown, 'f', laid(grown), '#000000');
    expect(est.pagesUsed).toBeGreaterThan(1);
    expect(est.added[0]).toMatchObject({ id: 'a1~1' });
    expect(texts(est.ops, 'a1~1').length).toBeGreaterThan(0);
    const drawn = pagesWithWriting(grown);
    expect(drawn.pages.map((pg) => pg.id)).toEqual(['a1', ...est.added.map((pg) => pg.id)]);
    expect(renderPagesToSvg(grown)).toContain('(added as the writing is laid out)');
  });

  it('stops at the most pages an estimate grows to, and reads nothing of an article or page it lacks', () => {
    const endless = article(
      Array.from({ length: ARTICLE_ESTIMATE_PAGES_MAX + 2 }, () => ({
        id: `x${Math.random()}`,
        type: 'pageBreak',
      })),
    );
    const est = estimateArticle(endless, 'f', laid(endless), '#000000');
    expect(est.overflows).toBe(true);
    expect(est.pagesUsed).toBe(ARTICLE_ESTIMATE_PAGES_MAX);
    const many = article(Array.from({ length: 2000 }, (_, i) => p(`Line ${i}`)));
    expect(estimateArticle(many, 'f', laid(many), '#000000').overflows).toBe(true);
    expect(estimateArticle(article([]), 'nope', laid(article([])), '#000000')).toMatchObject({
      pagesUsed: 0,
    });
  });
});
