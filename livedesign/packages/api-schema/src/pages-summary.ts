// How a tab's pages are summarised for agents (docs/specs/024-agents/pages-for-agents.md
// "change_pages" answer, "Reading: the pages view"): each page's place, kind, size and rectangle on
// the canvas, where update_document puts elements onto it. Shared by the api's answer (@livedesign/edit-operations) and
// the pages view (@livedesign/document-views).
import {
  elementIdsOnPage,
  pagesOf,
  layOutPages,
  pageHasOrientation,
  pageKindOf,
  pageContentBox,
  pageShowsSystemBars,
  type PageBackground,
  type Tab,
} from '@livedesign/document';
import type { PageSummary } from './pages';

export type PagesTab = Pick<Tab, 'elements' | 'pages'> & { pageOrientation?: unknown };

// A picture's overlay in words: "light 60%", or "no overlay".
const overlayWords = (o: { kind: string; strength: number } | undefined) =>
  o ? `${o.kind} ${Math.round(o.strength * 100)}%` : 'no overlay';

/** A background in words: `#0f172a`, `gradient #fde68a → #fca5a5`, `image, light 60%`, `dots`, or
 *  null for the paper. */
export function describeBackground(b: PageBackground | undefined): string | null {
  if (!b) return null;
  const fill =
    b.fill?.kind === 'solid'
      ? b.fill.color
      : b.fill?.kind === 'gradient'
        ? `gradient ${b.fill.from} → ${b.fill.to}`
        : b.fill?.kind === 'image'
          ? `image, ${overlayWords(b.fill.overlay)}`
          : null;
  return [fill, b.pattern ? `${b.pattern} pattern` : null].filter(Boolean).join(', ') || null;
}

const roundRect = (r: { x: number; y: number; width: number; height: number }) => ({
  x: Math.round(r.x),
  y: Math.round(r.y),
  width: Math.round(r.width),
  height: Math.round(r.height),
});

/** Every page as the answers list it. */
export function pageSummaries(tab: PagesTab): PageSummary[] {
  const laid = layOutPages(pagesOf(tab));
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
    elements: elementIdsOnPage(tab.elements, laid, p.id).size,
    ...(p.kind === 'wireframe'
      ? {
          device: p.device ?? 'iphone',
          frameLook: p.frameLook ?? 'theme',
          systemBars: pageShowsSystemBars(p),
          screen: roundRect(pageContentBox(p)),
        }
      : {}),
  }));
}
