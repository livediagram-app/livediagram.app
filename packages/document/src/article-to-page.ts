// Articles turned into Page elements (docs/specs/007-editor/article-pages.md "Leaving Illustrate"):
// what an editor may choose when switching a tab with articles to Diagram or Draw, where pages and
// their writing are not drawn. Each article page becomes a Page element (`shape: 'page'`) covering
// its sheet and holding that page's writing as rich text (the article's title and subtitle as the
// first page's masthead); the pages stay, as infographic pages, and every element on them stays
// where it is. Pure: which blocks fell on which page is measured by the editor, passed in.
import {
  articleListMarkers,
  articlesOf,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleRun,
} from './article-flow';
import { createShape } from './shape-factory';
import { PAGE_HEADING_MAX } from './data-shapes';
import {
  illustratePagesOf,
  layOutIllustratePages,
  withIllustratePages,
  type IllustratePage,
} from './illustrate-page';
import type { Element, ShapeElement, Tab } from './index';
import { runsPlainText, type RunHeading, type TextRun } from './rich-text';

type ArticlesTab = Pick<Tab, 'elements'> & { pages?: unknown; articles?: unknown };

const HEADING: Partial<Record<string, RunHeading>> = { title: 1, h1: 1, h2: 2, h3: 3 };

// One article run as a rich-text run, with the block's own look laid over it.
function textRun(run: ArticleRun, over: Partial<TextRun>): TextRun {
  const out: TextRun = { text: run.text, ...over };
  if (run.b) out.bold = true;
  if (run.i) out.italic = true;
  if (run.u) out.underline = true;
  if (run.s) out.strikethrough = true;
  if (run.href) out.link = run.href;
  if (run.color) out.color = run.color;
  return out;
}

const plain = (runs: readonly ArticleRun[]) => runs.map((r) => r.text).join('');

/** Blocks as one Page body: a line per block (a list item led by its marker, indented by its level;
 *  a divider as a rule; zones and page breaks left out, as their content stays on the canvas). */
export function articleBlocksAsRuns(
  blocks: readonly ArticleBlock[],
  markers: ReadonlyMap<string, string>,
): TextRun[] {
  const lines: TextRun[][] = [];
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      const heading = HEADING[b.style ?? 'body'];
      const over: Partial<TextRun> = heading
        ? { heading }
        : b.style === 'quote'
          ? { italic: true }
          : b.style === 'subtitle'
            ? { size: 'lg' }
            : {};
      lines.push(b.runs.length ? b.runs.map((r) => textRun(r, over)) : [{ text: '' }]);
    } else if (b.type === 'list') {
      const marker = b.list === 'todo' ? (b.checked ? '☑' : '☐') : (markers.get(b.id) ?? '•');
      const lead = `${'    '.repeat(b.level ?? 0)}${marker} `;
      lines.push([{ text: lead }, ...b.runs.map((r) => textRun(r, {}))]);
    } else if (b.type === 'code') {
      lines.push([{ text: b.text }]);
    } else if (b.type === 'divider') {
      lines.push([{ text: '———' }]);
    }
  }
  const out: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push({ text: '\n' });
    out.push(...line.filter((r) => r.text.length > 0));
  });
  return out;
}

/** One article's Page elements, a page each: `split` lists each page's block ids in order (what the
 *  editor measured); without it, the whole writing goes on the first page. */
export function articleAsPages(
  doc: ArticleFlow,
  pages: readonly { rect: { x: number; y: number; width: number; height: number } }[],
  split: readonly (readonly string[])[] | null,
): ShapeElement[] {
  const markers = articleListMarkers(doc.blocks);
  const byId = new Map(doc.blocks.map((b) => [b.id, b]));
  const groups: ArticleBlock[][] = split
    ? split.map((ids) => ids.flatMap((id) => byId.get(id) ?? []))
    : [[...doc.blocks]];
  // The article's own title and subtitle head its first page as the masthead.
  const first = groups[0] ?? [];
  const title = first.find((b) => b.type === 'paragraph' && b.style === 'title');
  const subtitle = first.find((b) => b.type === 'paragraph' && b.style === 'subtitle');
  if (groups[0]) groups[0] = first.filter((b) => b !== title && b !== subtitle);
  return pages.map((page, i) => {
    const shape = createShape('page', page.rect.x, page.rect.y);
    const runs = articleBlocksAsRuns(groups[i] ?? [], markers);
    const el: ShapeElement = {
      ...shape,
      width: page.rect.width,
      height: page.rect.height,
      // Ink on paper, as the writing was, whatever the tab's theme tints text with.
      textColor: '#1f2937',
      label: runsPlainText(runs),
      ...(runs.length ? { richText: runs } : {}),
    };
    if (i === 0 && title && title.type === 'paragraph' && plain(title.runs))
      el.pageTitle = plain(title.runs).slice(0, PAGE_HEADING_MAX);
    if (i === 0 && subtitle && subtitle.type === 'paragraph' && plain(subtitle.runs))
      el.pageSubtitle = plain(subtitle.runs).slice(0, PAGE_HEADING_MAX);
    return el;
  });
}

/**
 * The tab with every article turned into Page elements: the Page elements go under everything
 * else (they are the paper the rest was drawn on), the article pages become infographic pages, the
 * writing goes, and margin-note markers become ordinary annotations. `splits` holds, per article,
 * each page's block ids as laid out. The same tab back when it has no articles.
 */
export function withArticlesAsPages<T extends ArticlesTab>(
  tab: T,
  splits: ReadonlyMap<string, readonly (readonly string[])[]>,
): T {
  const docs = articlesOf(tab);
  if (Object.keys(docs).length === 0) return tab;
  const laid = layOutIllustratePages(illustratePagesOf(tab));
  const made: Element[] = [];
  for (const [flow, doc] of Object.entries(docs)) {
    const own = laid.filter((p) => p.flow === flow);
    if (own.length) made.push(...articleAsPages(doc, own, splits.get(flow) ?? null));
  }
  const pages: IllustratePage[] = illustratePagesOf(tab).map((p) => {
    if (p.kind !== 'article') return p;
    const { kind: _k, flow: _f, ...rest } = p;
    void _k;
    void _f;
    return { ...rest, kind: 'infographic' as const };
  });
  const elements = (tab.elements as Element[]).map((el) => {
    if (el.type !== 'annotation' || !el.articleNote) return el;
    const { articleNote: _n, ...rest } = el;
    void _n;
    return rest;
  });
  const repaged = withIllustratePages({ ...tab, elements: [...made, ...elements] }, pages);
  const { articles: _a, ...rest } = repaged as typeof repaged & { articles?: unknown };
  void _a;
  return rest as T;
}
