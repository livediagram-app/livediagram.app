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

// The studio the explorations show (docs/specs/007-editor/logo-pages.md "Logo layouts"), in place of the layouts'
// placeholder name, second word, initials and tagline.
export const LOGO_EXPLORATION_BRAND: Readonly<
  Record<'name' | 'second' | 'initials' | 'tagline', string>
> = {
  name: 'Lumen',
  second: 'Studio',
  initials: 'LM',
  tagline: 'Light for small spaces',
};

// The display face each exploration page sets its name in (fonts.md "The display library"): a different character
// on each page, so the family reads as real starts in real type. The tagline keeps the label face.
export const LOGO_EXPLORATION_FACES: Readonly<Record<LogoLayoutId, string>> = {
  'logo-icon-above': 'sora',
  'logo-icon-beside': 'outfit',
  'logo-stacked': 'syne',
  'logo-icon-right': 'manrope',
  'logo-divided': 'playfair-display',
  'logo-pill': 'fredoka',
  'logo-icon-below': 'league-spartan',
  'logo-wordmark': 'bricolage-grotesque',
  'logo-monogram': 'dm-serif-display',
  'logo-underlined': 'fraunces',
  'logo-two-lines': 'bebas-neue',
  'logo-spaced': 'cinzel',
  'logo-initial': 'instrument-serif',
  'logo-badge': 'fjalla-one',
  'logo-seal': 'marcellus',
  'logo-hexagon': 'chakra-petch',
  'logo-stamp': 'allerta-stencil',
  'logo-square-badge': 'archivo-black',
  'logo-diamond': 'young-serif',
  'logo-mark-disc': 'unbounded',
  'logo-mark-app': 'sora',
  'logo-mark-rings': 'syne',
  'logo-mark-initial': 'playfair-display',
  'logo-mark-peaks': 'league-spartan',
  'logo-mark-star': 'fraunces',
};

/** True for a template that is a logo exploration. */
export function isLogoExplorationKind(kind: TemplateKind): kind is LogoExplorationKind {
  return Object.hasOwn(LOGO_EXPLORATIONS, kind);
}
