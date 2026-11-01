import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from './article-flow';
import {
  ARTICLE_ESTIMATE_PAGES_MAX,
  estimateArticle,
  wrapEstimated,
} from './article-layout-estimate';
import { pagesWithWriting, renderPagesToSvg } from './svg-render-pages';
import { layOutPages, pagesOf } from './page';
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
    pages,
    articles: { f: { blocks, ...(opts.style ? { style: opts.style } : {}) } },
    elements: [],
  } as unknown as Tab;
}

const laid = (tab: Tab) => layOutPages(pagesOf(tab));
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

// docs/specs/007-editor/article-pages.md "Tables", "Table of contents", "Headers and footers".
describe('tables, contents and bands estimated', () => {
  const table = (rows: number, header = true): ArticleBlock => ({
    id: 'tb',
    type: 'table',
    ...(header ? { header: true as const } : {}),
    cols: [
      { id: 'c0', w: 0.5 },
      { id: 'c1', w: 0.5 },
    ],
    rows: Array.from({ length: rows }, (_, i) => ({
      id: `r${i}`,
      cells: [
        [{ text: i === 0 ? 'Name' : `Row ${i}` }],
        i === 1 ? [{ text: 'all bold', b: true }] : i === 2 ? [] : [{ text: 'v' }],
      ],
    })),
  });

  it('sets a table’s cells and hairlines, repeating its header row on each page it continues onto', () => {
    const tab = article([p('Before'), table(90)]);
    const est = estimateArticle(tab, 'f', laid(tab), '#000000');
    expect(est.pagesUsed).toBeGreaterThan(1);
    expect(texts(est.ops, 'a1')).toContain('Row 1');
    expect(texts(est.ops, 'a1').filter((t) => t === 'Name')).toHaveLength(1);
    const second = est.added[0]!.id;
    expect(texts(est.ops, second)[0]).toBe('Name');
    expect((est.ops.get('a1') ?? []).some((o) => o.k === 'line')).toBe(true);
  });

  it('never repeats a row when the table has no header row', () => {
    const tab = article([table(90, false)]);
    const est = estimateArticle(tab, 'f', laid(tab), '#000000');
    expect(texts(est.ops, est.added[0]!.id)[0]).not.toBe('Name');
  });

  it('stops a table at the estimate’s page limit', () => {
    const tab = article([table(500)]);
    expect(estimateArticle(tab, 'f', laid(tab), '#000000').overflows).toBe(false);
    const huge: ArticleBlock[] = Array.from({ length: 40 }, (_, i) => ({
      ...(table(60) as object),
      id: `t${i}`,
    })) as ArticleBlock[];
    const big = article(huge);
    expect(estimateArticle(big, 'f', laid(big), '#000000').overflows).toBe(true);
  });

  it('lists the headings under "Contents" with the pages the first pass put them on', () => {
    const tab = article([
      { id: 'toc', type: 'toc', depth: 2 },
      p('Intro', 'h1'),
      { id: 'pb', type: 'pageBreak' },
      p('Later', 'h2'),
      p('Small', 'h3'),
    ]);
    const est = estimateArticle(tab, 'f', laid(tab), '#000000');
    const first = texts(est.ops, 'a1');
    expect(first.slice(0, 5)).toEqual(['Contents', 'Intro', '1', 'Later', '2']);
    expect(first).not.toContain('Small');
    expect((est.ops.get('a1') ?? []).some((o) => o.k === 'line' && o.dash)).toBe(true);
  });

  it('runs a contents block onto the next page when it does not fit, and stops at the limit', () => {
    const headings = Array.from({ length: 80 }, (_, i) => p(`Heading ${i}`, 'h1'));
    const tab = article([{ id: 'toc', type: 'toc' }, ...headings]);
    const est = estimateArticle(tab, 'f', laid(tab), '#000000');
    expect(texts(est.ops, est.added[0]!.id)).toContain('Heading 50');
    const full = article([
      ...Array.from({ length: ARTICLE_ESTIMATE_PAGES_MAX }, (_, i) => ({
        id: `x${i}`,
        type: 'pageBreak' as const,
      })),
      { id: 'toc', type: 'toc' },
      ...headings,
    ]);
    expect(estimateArticle(full, 'f', laid(full), '#000000').overflows).toBe(true);
  });

  it('draws the header, the footer and the page number on each page, none on a first page set apart', () => {
    const style = {
      pageNumbers: true,
      header: { left: 'Brief', right: '{pages} pages' },
      footer: { left: 'Draft' },
      differentFirstPage: true,
    };
    const tab = article([p('One'), { id: 'pb', type: 'pageBreak' }, p('Two')], { style });
    const est = estimateArticle(tab, 'f', laid(tab), '#000000');
    expect(texts(est.ops, 'a1')).not.toContain('Brief');
    expect(texts(est.ops, est.added[0]!.id)).toEqual(
      expect.arrayContaining(['Brief', '2 pages', 'Draft', '2']),
    );
  });

  it('sets a contents block after writing, in the accent, a long heading cut before its page', () => {
    const tab = article([p('Lead'), { id: 'toc', type: 'toc' }, p('W'.repeat(400), 'h1')], {
      style: { look: 'report', header: { left: 'H' } },
    });
    const est = estimateArticle(tab, 'f', laid(tab), '#000000');
    const first = texts(est.ops, 'a1');
    expect(first.slice(0, 2)).toEqual(['Lead', 'Contents']);
    expect(first[2]!.length).toBeLessThan(400);
    expect(first).toContain('H');
  });

  it('stops a contents block on the last page the estimate makes', () => {
    const headings = Array.from({ length: 80 }, (_, i) => p(`Heading ${i}`, 'h1'));
    const tab = article([
      ...Array.from({ length: ARTICLE_ESTIMATE_PAGES_MAX - 2 }, (_, i) => ({
        id: `x${i}`,
        type: 'pageBreak' as const,
      })),
      { id: 'toc', type: 'toc' },
      ...headings,
    ]);
    expect(estimateArticle(tab, 'f', laid(tab), '#000000').overflows).toBe(true);
  });
});
