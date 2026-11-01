// Logo explorations (docs/specs/007-editor/logo-pages.md "Logo layouts"): one template per logo layout family, one
// logo page per layout in it, named for the layout. A designer compares the family side by side on real artboards
// (so the guides, mirror, Combine and Logo Kit all work), keeps the one that fits and deletes the rest. Pure: the
// pages are declared once and each layout built on its page.
import { layOutPages, type Element, type Page } from '@livedesign/design';
import { LOGO_LAYOUTS, type LogoLayoutId } from './logo-layouts';
import { buildPageLayout } from './page-layout-build';
import { templateLogoPage } from './template-page-kit';
import type { TemplateKind } from './templates';

export type LogoExplorationKind = Extract<
  TemplateKind,
  'logo-lockups' | 'logo-wordmarks' | 'logo-emblems' | 'logo-marks'
>;

// Each exploration's layouts, in the order the Logo palette lists them.
export const LOGO_EXPLORATIONS: Record<LogoExplorationKind, readonly LogoLayoutId[]> = {
  'logo-lockups': [
    'logo-icon-above',
    'logo-icon-beside',
    'logo-stacked',
    'logo-icon-right',
    'logo-divided',
    'logo-pill',
    'logo-icon-below',
  ],
  'logo-wordmarks': [
    'logo-wordmark',
    'logo-monogram',
    'logo-underlined',
    'logo-two-lines',
    'logo-spaced',
    'logo-initial',
  ],
  'logo-emblems': [
    'logo-badge',
    'logo-seal',
    'logo-hexagon',
    'logo-stamp',
    'logo-square-badge',
    'logo-diamond',
  ],
  'logo-marks': [
    'logo-mark-disc',
    'logo-mark-app',
    'logo-mark-rings',
    'logo-mark-initial',
    'logo-mark-peaks',
    'logo-mark-star',
  ],
};

const LABEL: ReadonlyMap<string, string> = new Map(LOGO_LAYOUTS.map((l) => [l.id, l.label]));

/** True for a template that is a logo exploration. */
export function isLogoExplorationKind(kind: TemplateKind): kind is LogoExplorationKind {
  return Object.hasOwn(LOGO_EXPLORATIONS, kind);
}

/** An exploration's pages: one logo page per layout, named for it. */
export function logoExplorationPages(kind: LogoExplorationKind): Page[] {
  return LOGO_EXPLORATIONS[kind].map((id, i) => templateLogoPage(i + 1, LABEL.get(id) ?? id));
}

/** An exploration's elements: each layout on its page. */
export function buildLogoExploration(kind: LogoExplorationKind): Element[] {
  const layouts = LOGO_EXPLORATIONS[kind];
  return layOutPages(logoExplorationPages(kind)).flatMap((page, i) =>
    buildPageLayout(layouts[i]!, page),
  );
}
