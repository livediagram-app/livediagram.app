// The accent a knowledgebase's theme gives its writing and its chrome (docs/specs/030-knowledgebase/page-surface.md
// "Knowledgebase Style", "The chrome follows the theme"). The product's own theme is lime, the brand's own ramp
// (packages/tailwind-config/theme.css); every other theme's accent is its stroke (a multi-colour theme's first
// branch), read from its light half so a theme tints the chrome the same way in both appearances: the ramp spun
// from it has its own dark half.
import {
  DEFAULT_SCHEME_ID,
  contrastRatio,
  isArticleHex,
  shade,
  themeAccent,
  tint,
  type KnowledgeStyle,
} from '@liveknowledge/document';
import { editorAccentCss } from '@liveworkspace/workbench/hooks/ui/editor-accent';
import { getTheme } from '@/lib/themes';

// brand-600 of the lime ramp: what the product's own theme paints the writing's accent in.
export const LIME_ACCENT = '#4d7c0f';

/** The theme's accent as a hex; lime for the product's own. */
export function knowledgeThemeAccent(themeId: string | undefined): string {
  if (!themeId || themeId === DEFAULT_SCHEME_ID) return LIME_ACCENT;
  const theme = getTheme(themeId, 'light');
  // A multi-colour theme's own stroke is a neutral grey, there for the root of a diagram: its writing takes a
  // branch's colour, so Spectrum reads as its theme and not as a grey page. The first branch that is neither red
  // nor amber: those are what errors and Review Due are said in, in every theme.
  const branches = (theme.palette ?? []).map((p) => p.stroke).filter(isArticleHex);
  const branch = branches.find((c) => !isWarm(c)) ?? branches[0];
  return branch ?? themeAccent(theme);
}

// A colour's hue in degrees, 0 to 360; -1 for a grey.
function hueOf(hex: string): number {
  const full = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (d) => d + d) : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  if (span === 0) return -1;
  const sixth =
    max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return (sixth * 60 + 360) % 360;
}
// Red through amber and yellow: the hues errors (red) and Review Due (amber) are said in.
const WARM_FROM = 330;
const WARM_TO = 65;
const isWarm = (hex: string): boolean => {
  const hue = hueOf(hex);
  return hue >= WARM_FROM || (hue >= 0 && hue <= WARM_TO);
};

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
