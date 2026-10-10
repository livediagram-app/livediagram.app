// How a tab's Illustrate pages and articles are summarised for agents (docs/specs/024-agents/
// illustrate-for-agents.md "change_pages" answer, "Reading: the pages view"): each page's place,
// kind, size and rectangle on the canvas, where update_document puts elements onto it; each
// article's title, pages and size. Shared by the api's answer (@livediagram/edit-operations) and
// the pages view (@livediagram/document-views).
import {
  articlesOf,
  articleTitleOf,
  articleWordCount,
  elementIdsOnPage,
  illustratePagesOf,
  layOutIllustratePages,
  pageHasOrientation,
  pageKindOf,
  type PageBackground,
  type Tab,
} from '@livediagram/document';
import type { ArticleSummary, PageSummary } from './illustrate';

export type PagesTab = Pick<Tab, 'elements' | 'pages' | 'articles'> & { pageOrientation?: unknown };

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
