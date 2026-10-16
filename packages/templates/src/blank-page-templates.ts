// The blanks of a page kind (docs/specs/007-editor/templates-by-mode.md "Blanks of a page kind"): Blank Slide Deck,
// Blank Article, Blank Infographic and Blank Logo, each a tab that opens in Illustrate on exactly one empty page whose
// kind is already chosen. The page is made the way the first page's What Is This Page For? makes it
// (withPageKindChosen on an unchosen page), so a blank of a kind and a chosen Blank Illustration are the same page.
// Pure: merged in by templateCanvasOverrides, so every application path (the picker, /new, the MCP worker) lands it.
import {
  illustratePagesOf,
  withDefaultPageBackgrounds,
  withPageKindChosen,
  type PageKind,
  type Tab,
  type ThemeDefinition,
} from '@livediagram/document';
import type { TemplateKind } from './templates';

// Each blank of a page kind and the kind its one page is.
export const BLANK_PAGE_TEMPLATE_KINDS = {
  'blank-slide-deck': 'slide',
  'blank-article': 'article',
  'blank-infographic': 'infographic',
  'blank-logo': 'logo',
} as const satisfies Partial<Record<TemplateKind, PageKind>>;

type BlankPageTemplateKind = keyof typeof BLANK_PAGE_TEMPLATE_KINDS;

// The blank article's flow id: the tab holds no other article, so a fixed id cannot collide.
const BLANK_ARTICLE_FLOW = 'art-1';

function isBlankPageTemplate(kind: TemplateKind): kind is BlankPageTemplateKind {
  return Object.hasOwn(BLANK_PAGE_TEMPLATE_KINDS, kind);
}

/** The tab data of a blank of a page kind (its one page, and an article's empty writing), or undefined for any other
 *  template. */
export function blankPageTemplateOverrides(kind: TemplateKind): Partial<Tab> | undefined {
  if (!isBlankPageTemplate(kind)) return undefined;
  // The page a new Illustrate tab starts on, never chosen.
  const unchosen = { elements: [], pages: illustratePagesOf(undefined) };
  const chosen = withPageKindChosen(
    unchosen,
    unchosen.pages[0]!.id,
    BLANK_PAGE_TEMPLATE_KINDS[kind],
    BLANK_ARTICLE_FLOW,
  )!;
  // An article page's writing (an empty Title and paragraph) comes with it.
  const { articles } = chosen as Partial<Tab>;
  return { opensIn: 'illustrate', pages: chosen.pages, ...(articles ? { articles } : {}) };
}

/** A blank infographic's page on the tab theme's default background (docs/specs/007-editor/
 *  illustrate-pages.md "A new page's background"), as a page added in the editor starts; any other
 *  template's tab as it is (one with content keeps the paper it was designed on). */
export function withBlankPageThemed<T extends Partial<Pick<Tab, 'pages'>>>(
  tab: T,
  kind: TemplateKind,
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): T {
  return kind === 'blank-infographic' ? withDefaultPageBackgrounds(tab, theme) : tab;
}
