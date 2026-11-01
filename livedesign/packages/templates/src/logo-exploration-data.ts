// The logo explorations' data (docs/specs/007-editor/logo-pages.md "Logo layouts"): each exploration's logo layouts,
// in the order the Logo palette lists them. Pure data with type-only imports, so the template previews can read it
// (the `./template-flow-data` export) without pulling the logo layout builders into a page's bundle.
import type { LogoLayoutId } from './logo-layouts';
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

/** True for a template that is a logo exploration. */
export function isLogoExplorationKind(kind: TemplateKind): kind is LogoExplorationKind {
  return Object.hasOwn(LOGO_EXPLORATIONS, kind);
}
