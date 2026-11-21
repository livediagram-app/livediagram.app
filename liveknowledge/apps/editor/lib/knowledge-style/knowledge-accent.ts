// The accent a knowledgebase's theme gives its writing and its chrome (docs/specs/030-knowledgebase/page-surface.md
// "Knowledgebase Style", "The chrome follows the theme"). The product's own theme is lime, the brand's own ramp
// (packages/tailwind-config/theme.css); every other theme's accent is its stroke (a multi-colour theme's first
// branch), read from its light half so a theme tints the chrome the same way in both appearances: the ramp spun
// from it has its own dark half.
import {
  DEFAULT_SCHEME_ID,
  contrastRatio,
  knowledgeThemeAccent,
  shade,
  tint,
  type KnowledgeStyle,
} from '@liveknowledge/document';
import { editorAccentCss } from '@liveworkspace/workbench/hooks/ui/editor-accent';

// The theme's own accent is the document package's (knowledge-accent.ts), shared with the public site.
export { LIME_ACCENT, knowledgeThemeAccent } from '@liveknowledge/document';

// The dark appearance's ground under the product's own theme: slate-900 of the shared dark palette
// (packages/tailwind-config/theme.css `.dark`), which the page stands on (app/globals.css).
const LIME_DARK_GROUND = '#131b26';

/** The ground a page stands on in the dark appearance under a theme: the chrome's own dark surface, which a theme
 *  other than the product's tints (@liveworkspace/workbench hooks/ui/editor-accent.ts). For a card that draws a
 *  look in the dark, and for the contrast tests. */
export function knowledgeDarkGround(themeId: string | undefined): string {
  const accent = knowledgeChromeAccent(themeId);
  if (!accent) return LIME_DARK_GROUND;
  return /--color-slate-900:(#[0-9a-f]{6});/.exec(editorAccentCss(accent))?.[1] ?? LIME_DARK_GROUND;
}

/** The writing's accent: the one someone picked, else the theme's. Held legible on its paper where it is drawn. */
export function knowledgeWritingAccent(style: Pick<KnowledgeStyle, 'theme' | 'accent'>): string {
  return style.accent ?? knowledgeThemeAccent(style.theme);
}

// WCAG 2.2 AA for text, and the steps of the walk: 4% deeper each, so twenty-five reach black.
const TEXT_CONTRAST = 4.5;
const DEEPEN = 0.04;
const DEEPEN_STEPS = 25;

// The pairs the chrome draws text in off the ramp spun from an accent (@liveworkspace/workbench
// hooks/ui/editor-accent.ts brandScale: 600 is the accent, 700 it shaded 18%, 50 it tinted 92%): white on a
// 600 fill (a primary button, the dark half's solid fills), and 700 on a 50 wash (a selected menu row, the
// formatting bar's active state).
const rampReads = (base: string): boolean =>
  contrastRatio('#ffffff', base) >= TEXT_CONTRAST &&
  contrastRatio(shade(base, 0.18), tint(base, 0.92)) >= TEXT_CONTRAST;

/** What the chrome's ramp is spun from: the theme's accent, or null for the product's own theme, whose built-in
 *  ramp stands. A picked writing accent never tints the chrome. A theme whose accent is too light to carry text
 *  (a pastel's rose, a yellow) is deepened, hue kept, until the ramp's text pairs read at 4.5:1: the shared ramp
 *  only deepens what it calls light, and a mid-tone orange passes it at 2.8:1. */
export function knowledgeChromeAccent(themeId: string | undefined): string | null {
  if (!themeId || themeId === DEFAULT_SCHEME_ID) return null;
  let base = knowledgeThemeAccent(themeId);
  for (let i = 0; i < DEEPEN_STEPS && !rampReads(base); i += 1) base = shade(base, DEEPEN);
  return base;
}
