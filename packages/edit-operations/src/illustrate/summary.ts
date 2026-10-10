// How an agent is told what a tab's pages and articles are now (docs/specs/024-agents/
// illustrate-for-agents.md "change_pages" answer, "Reading: the pages view"): each page's place,
// kind, size and rectangle on the canvas, where update_document puts elements onto it; each
// article's title, pages and size. Shared by the route's answer and the pages view.
import type { ArticleSummary, PageRef, PageSummary } from '@livediagram/api-schema';
import {
  articlesOf,
  articleTitleOf,
  articleWordCount,
  elementIdsOnPage,
  illustratePagesOf,
  layOutIllustratePages,
  pageHasOrientation,
  pageKindOf,
  PAGE_SIZES,
  type IllustratePage,
  type PageBackground,
  type Tab,
} from '@livediagram/document';

type PagesTab = Pick<Tab, 'elements' | 'pages' | 'articles'> & { pageOrientation?: unknown };

/** A background in words: `#0f172a`, `gradient #fde68a → #fca5a5`, `dots`, or null for the paper. */
export function describeBackground(b: PageBackground | undefined): string | null {
  if (!b) return null;
  const fill =
    b.fill?.kind === 'solid'
      ? b.fill.color
      : b.fill?.kind === 'gradient'
        ? `gradient ${b.fill.from} → ${b.fill.to}`
        : null;
  return [fill, b.pattern ? `${b.pattern} pattern` : null].filter(Boolean).join(', ') || null;
}

/** Every page as the answers list it. */
export function pageSummaries(tab: PagesTab): PageSummary[] {
  const laid = layOutIllustratePages(illustratePagesOf(tab));
  return laid.map((p, i) => ({
    place: i + 1,
    id: p.id,
    name: p.name ?? null,
    kind: pageKindOf(p),
    size: p.size ?? 'a4',
    orientation: pageHasOrientation(p) ? p.orientation : null,
    rect: {
      x: Math.round(p.rect.x),
      y: Math.round(p.rect.y),
      width: Math.round(p.rect.width),
      height: Math.round(p.rect.height),
    },
    background: describeBackground(p.background),
    locked: p.locked === true,
    flow: p.flow ?? null,
    elements: elementIdsOnPage(tab.elements, laid, p.id).size,
  }));
}

/** Every article as the answers list it, in row order. */
export function articleSummaries(tab: PagesTab): ArticleSummary[] {
  const pages = illustratePagesOf(tab);
  const articles = articlesOf(tab);
  const seen: string[] = [];
  for (const p of pages)
    if (p.flow && articles[p.flow] && !seen.includes(p.flow)) seen.push(p.flow);
  return seen.map((flow) => {
    const doc = articles[flow]!;
    return {
      flow,
      title: articleTitleOf(doc),
      pages: pages.flatMap((p, i) => (p.flow === flow ? [i + 1] : [])),
      blocks: doc.blocks.length,
      words: articleWordCount(doc),
      look: doc.style?.look ?? null,
    };
  });
}

/** A page's label in lines and lists: `2 Cover (slide)`, `3 (article)`. */
export function pageLabel(page: PageSummary): string {
  return `${page.place}${page.name ? ` ${page.name}` : ''} (${page.kind})`;
}

/** A size in words for a result line: `16:9`, `A4 portrait`, `1024 x 1024`. */
export function sizeLabel(page: Pick<IllustratePage, 'size' | 'orientation' | 'kind'>): string {
  const size = PAGE_SIZES[page.size ?? 'a4'];
  const label = page.orientation === 'landscape' ? size.landscape : size.portrait;
  return pageHasOrientation(page) && size.short !== size.long
    ? `${label} ${page.orientation}`
    : label;
}

const nameKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();

/** The page a ref names: an id, then a 1-based place, then a name (case and spacing aside). */
export function resolvePage(
  pages: readonly IllustratePage[],
  ref: PageRef,
): IllustratePage | undefined {
  if (typeof ref === 'string') {
    const byId = pages.find((p) => p.id === ref);
    if (byId) return byId;
    if (/^\d+$/.test(ref.trim())) return pages[Number(ref.trim()) - 1];
    const key = nameKey(ref);
    return pages.find((p) => p.name && nameKey(p.name) === key);
  }
  return pages[ref - 1];
}
