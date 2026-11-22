// How a tab's pages and articles are summarised for agents (docs/specs/024-agents/
// pages-for-agents.md "change_pages" answer, "Reading: the pages view"): each page's place,
// kind, size and rectangle on the canvas, where update_document puts elements onto it; each
// article's title, pages and size. Shared by the api's answer (@livedocuments/edit-operations) and
// the pages view (@livedocuments/document-views).
import {
  articlesOf,
  articleTitleOf,
  articleReadability,
  articleWordCount,
  estimateArticle,
  elementIdsOnPage,
  pagesOf,
  layOutPages,
  pageHasOrientation,
  READING_LEVEL_LABEL,
  pageKindOf,
  computeRefs,
  type PageBackground,
  type Tab,
} from '@livedocuments/document';
import { textsLeftOutLine, withLaidOutTexts } from '@liveworkspace/edit-operations/laid-out-texts';
import type { ArticleReadabilitySummary, ArticleSummary, LaidOutTexts, PageSummary } from './pages';

export type PagesTab = Pick<Tab, 'elements' | 'pages' | 'articles'> & { pageOrientation?: unknown };

// A picture's overlay in words: "light 60%", or "no overlay".
const overlayWords = (o: { kind: string; strength: number } | undefined) =>
  o ? `${o.kind} ${Math.round(o.strength * 100)}%` : 'no overlay';

/** A background in words: `#0f172a`, `gradient #fde68a → #fca5a5`, `image, light 60%, blur 40%`, `dots`, or
 *  null for the paper. */
export function describeBackground(b: PageBackground | undefined): string | null {
  if (!b) return null;
  const fill =
    b.fill?.kind === 'solid'
      ? b.fill.color
      : b.fill?.kind === 'gradient'
        ? `gradient ${b.fill.from} → ${b.fill.to}`
        : b.fill?.kind === 'image'
          ? `image, ${overlayWords(b.fill.overlay)}${b.fill.blur ? `, blur ${Math.round(b.fill.blur * 100)}%` : ''}`
          : null;
  return [fill, b.pattern ? `${b.pattern} pattern` : null].filter(Boolean).join(', ') || null;
}

const roundRect = (r: { x: number; y: number; width: number; height: number }) => ({
  x: Math.round(r.x),
  y: Math.round(r.y),
  width: Math.round(r.width),
  height: Math.round(r.height),
});

/** Every page as the answers list it; each one `laidOut` names (a change laid it out) with its texts. */
export function pageSummaries(tab: PagesTab, laidOut?: LaidOutTexts): PageSummary[] {
  const laid = layOutPages(pagesOf(tab));
  const pages = laid.map((p, i) => ({
    place: i + 1,
    id: p.id,
    name: p.name ?? null,
    kind: pageKindOf(p),
    size: p.size ?? 'a4',
    orientation: pageHasOrientation(p) ? p.orientation : null,
    rect: roundRect(p.rect),
    background: describeBackground(p.background),
    locked: p.locked === true,
    flow: p.flow ?? null,
    elements: elementIdsOnPage(tab.elements, laid, p.id).size,
  }));
  // The refs are worked out only when a page was laid out: most answers list no texts.
  if (!laidOut?.size) return pages;
  return withLaidOutTexts(
    pages,
    laidOut,
    tab.elements,
    computeRefs(tab.elements.map((el) => el.id)).refOf,
  );
}

/** The answer's line for laid-out pages whose texts did not fit it, or null. */
export const pagesTextsLeftOut = (pages: readonly PageSummary[], laidOut?: LaidOutTexts) =>
  textsLeftOutLine(pages, laidOut, 'read_document with view "pages"');

/** Every article as the answers list it, in row order. */
export function articleSummaries(tab: PagesTab): ArticleSummary[] {
  const pages = pagesOf(tab);
  const laid = layOutPages(pages);
  const articles = articlesOf(tab);
  const seen: string[] = [];
  for (const p of pages)
    if (p.flow && articles[p.flow] && !seen.includes(p.flow)) seen.push(p.flow);
  return seen.map((flow) => {
    const doc = articles[flow]!;
    const words = articleWordCount(doc);
    const r = articleReadability(doc, words);
    return {
      flow,
      title: articleTitleOf(doc),
      pages: pages.flatMap((p, i) => (p.flow === flow ? [i + 1] : [])),
      blocks: doc.blocks.length,
      words,
      // How many pages its writing reaches once laid out, estimated without a browser (the editor adds pages to
      // hold it, and drops those it leaves empty).
      estimatedPages: Math.max(1, estimateArticle(tab, flow, laid, '#000000').pagesUsed),
      readability: {
        readingMinutes: r.readingMinutes,
        sentences: r.sentences,
        wordsPerSentence: r.wordsPerSentence,
        longSentences: r.longSentences,
        ease: r.ease,
        level: r.level ? READING_LEVEL_LABEL[r.level] : null,
      },
      look: doc.style?.look ?? null,
    };
  });
}

/** How easily an article reads, in the pages view's words: "4 min read · Easy to read · 2 long sentences" (a part
 *  with nothing to say left out); empty for no words. */
export function readabilityWords(r: ArticleReadabilitySummary): string {
  const parts: string[] = [];
  if (r.readingMinutes > 0) parts.push(`${r.readingMinutes} min read`);
  if (r.level) parts.push(r.level);
  if (r.longSentences > 0)
    parts.push(`${r.longSentences} long ${r.longSentences === 1 ? 'sentence' : 'sentences'}`);
  return parts.join(' · ');
}
