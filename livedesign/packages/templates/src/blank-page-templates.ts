// The blanks of a page kind: Blank Logo, the blank wireframes and Photo Edit, each a tab that opens in Pages on
// exactly one empty page whose kind is already chosen. The page is made the way the first page's What Is This Page
// For? makes it (withPageKindChosen on an unchosen page), so a blank of a kind and a chosen Blank Illustration are the same page.
// Pure: merged in by templateCanvasOverrides, so every application path (the picker, /new, the MCP worker) lands it.
import {
  pagesOf,
  withPageKindChosen,
  type PageKind,
  type Tab,
  type WireframeDeviceId,
} from '@livedesign/design';
import type { TemplateKind } from './templates';

// Each blank of a page kind and the kind its one page is.
export const BLANK_PAGE_TEMPLATE_KINDS = {
  'blank-logo': 'logo',
  'blank-wireframe-phone': 'wireframe',
  'blank-wireframe-tablet': 'wireframe',
  'blank-wireframe-browser': 'wireframe',
  'blank-wireframe-laptop': 'wireframe',
  'blank-wireframe-watch': 'wireframe',
  // An unstarted photo page: its Start a Photo card asks for a picture or a blank (docs/specs/031-photo/photo-pages.md).
  'photo-edit': 'photo',
} as const satisfies Partial<Record<TemplateKind, PageKind>>;

// Each blank wireframe's device (docs/specs/007-editor/wireframe-pages.md "Templates").
const BLANK_WIREFRAME_DEVICES: Partial<Record<TemplateKind, WireframeDeviceId>> = {
  'blank-wireframe-phone': 'iphone',
  'blank-wireframe-tablet': 'ipad',
  'blank-wireframe-browser': 'browser',
  'blank-wireframe-laptop': 'laptop',
  'blank-wireframe-watch': 'watch',
};

type BlankPageTemplateKind = keyof typeof BLANK_PAGE_TEMPLATE_KINDS;

function isBlankPageTemplate(kind: TemplateKind): kind is BlankPageTemplateKind {
  return Object.hasOwn(BLANK_PAGE_TEMPLATE_KINDS, kind);
}

/** The tab data of a blank of a page kind (its one page), or undefined for any other
 *  template. */
export function blankPageTemplateOverrides(kind: TemplateKind): Partial<Tab> | undefined {
  if (!isBlankPageTemplate(kind)) return undefined;
  // The page a new Pages tab starts on, never chosen.
  const unchosen = { elements: [], pages: pagesOf(undefined) };
  const chosen = withPageKindChosen(
    unchosen,
    unchosen.pages[0]!.id,
    BLANK_PAGE_TEMPLATE_KINDS[kind],
    BLANK_WIREFRAME_DEVICES[kind],
  )!;
  return { opensIn: 'pages', pages: chosen.pages };
}
