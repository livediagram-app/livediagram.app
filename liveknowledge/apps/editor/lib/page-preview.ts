// Tab Style's page sample (docs/specs/011-theme/canvas-and-theme-dialog.md "Previews"): one page of the kind the
// dialog styles (a slide, an infographic page, a card or an article), on the background new pages start on, with a
// title and a step, an arrow and a decision on it (an article: its title and two paragraphs), drawn by the page
// exporter in the tab's theme, finish and font, so the sample is what a page of the tab will look like. Pure.
import {
  articleFromMarkdown,
  layOutPages,
  newSlidePage,
  pagesInkFor,
  renderPageToSvg,
  type ArticleBlock,
  type Element,
  type Finish,
  type Page,
  type PageBackground,
  type PageKind,
  type Tab,
  type TextSize,
} from '@liveknowledge/document';
import { withThemeApplied } from '@/lib/tab-theme-apply';

const PAGE_ID = 'tab-style-sample';

// The sample's article: a title over two short paragraphs.
const ARTICLE_MARKDOWN =
  '# Quarterly review\n\nThe team shipped the new onboarding and halved the time to a first document.\n\n' +
  'Next quarter we take the same care to sharing, so a link reads well wherever it lands.';

// The sample markdown always reads (it is fixed and short), so its blocks are there.
const SAMPLE_BLOCKS = (articleFromMarkdown(ARTICLE_MARKDOWN) as { blocks: ArticleBlock[] }).blocks;

function samplePage(kind: PageKind, background: PageBackground | undefined): Page {
  const own = background && (background.fill || background.pattern) ? { background } : {};
  if (kind === 'slide') return { ...newSlidePage(PAGE_ID), ...own };
  if (kind === 'flashcard')
    return { id: PAGE_ID, orientation: 'landscape', size: 'card', kind, flow: PAGE_ID, ...own };
  if (kind === 'article')
    return { id: PAGE_ID, orientation: 'portrait', kind, flow: PAGE_ID, ...own };
  return { id: PAGE_ID, orientation: 'landscape', kind: 'infographic', ...own };
}

// A title, then a step, an arrow and a decision across the page, in proportion to it.
function sampleElements(
  rect: { x: number; y: number; width: number; height: number },
  textSize: TextSize | undefined,
): Element[] {
  const u = rect.width / 100;
  const at = (x: number, y: number) => ({ x: rect.x + x * u, y: rect.y + y * u });
  const body = textSize ?? Math.round(3.4 * u);
  const step = { ...at(10, 26), width: 30 * u, height: 14 * u };
  const decision = { ...at(58, 22), width: 28 * u, height: 22 * u };
  return [
    {
      id: 'sample-title',
      type: 'text',
      ...at(10, 8),
      width: 80 * u,
      height: 10 * u,
      label: 'Quarterly review',
      textSize: Math.round(6 * u),
      textAlignX: 'left',
    },
    {
      id: 'sample-step',
      type: 'shape',
      shape: 'square',
      ...step,
      label: 'Plan the work',
      textSize: body,
    },
    {
      id: 'sample-decision',
      type: 'shape',
      shape: 'diamond',
      ...decision,
      label: 'Ready?',
      textSize: body,
    },
    {
      id: 'sample-arrow',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'sample-step', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'sample-decision', anchor: 'w' },
    },
  ] as Element[];
}

/** The sample page as SVG markup: `kind`'s page on `background`, in the tab's theme, finish and font. */
export function pagePreviewSvg(opts: {
  kind: PageKind;
  background: PageBackground | undefined;
  theme: string;
  finish: Finish;
  font?: string;
  // The size new text takes (the Text panel); the sample's own sizes when omitted.
  textSize?: TextSize;
}): string {
  const page = layOutPages([samplePage(opts.kind, opts.background)])[0]!;
  const written = opts.kind === 'article' || opts.kind === 'flashcard';
  const blank: Tab = {
    id: 'tab-style-sample',
    name: 'Sample',
    elements: written ? [] : sampleElements(page.rect, opts.textSize),
    pages: [page],
    ...(written
      ? {
          articles: {
            [PAGE_ID]: { blocks: SAMPLE_BLOCKS },
          },
        }
      : {}),
  };
  // The theme's colours, then re-inked for the page as a pick of its background re-inks (a dark page's text light).
  const themed = withThemeApplied(blank, opts.theme);
  const inked = page.background
    ? pagesInkFor(themed, [{ pageId: PAGE_ID, background: page.background }]).tab
    : themed;
  const tab: Tab = {
    ...inked,
    finish: opts.finish,
    ...(opts.font ? { font: opts.font } : {}),
  };
  return renderPageToSvg(tab, page);
}
