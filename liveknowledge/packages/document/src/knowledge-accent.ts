// The accent a knowledgebase's theme gives its writing (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase
// Style"): lime for the product's own theme, every other theme's stroke (a multi-colour theme's first branch that is
// neither red nor amber). One copy for the editor, the public site (docs/specs/030-knowledgebase/publishing.md) and
// the api's preview (knowledge-style-view.ts), read from the theme's light half so both appearances start from the
// same colour.
import { DEFAULT_SCHEME_ID } from '@liveworkspace/element-model/themes';
import { hexToRgb } from './colors';
import { isArticleHex } from './article-flow';
import { themeAccent } from './page-default-background';
import { getBuiltInTheme, type ThemeDefinition } from './themes';

// brand-600 of the lime ramp (packages/tailwind-config/theme.css): what the product's own theme paints the writing's
// accent in.
export const LIME_ACCENT = '#4d7c0f';

// A colour's hue in degrees, 0 to 360; -1 for a grey (and for what does not read as a colour).
function hueOf(hex: string): number {
  const { r, g, b } = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
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
/** Whether a colour is red through amber and yellow, which a theme's writing accent passes over. A grey is not. */
export const isWarmAccent = (hex: string): boolean => {
  const hue = hueOf(hex);
  return hue >= WARM_FROM || (hue >= 0 && hue <= WARM_TO);
};

/** The theme's accent as a hex; lime for the product's own. Every other theme's is its stroke, read from its light
 *  half so a theme tints the same way in both appearances. */
export function knowledgeThemeAccent(themeId: string | undefined): string {
  if (!themeId || themeId === DEFAULT_SCHEME_ID) return LIME_ACCENT;
  return writingAccentOf(getBuiltInTheme(themeId, 'light'));
}

/** A theme's writing accent. A multi-colour theme's own stroke is a neutral grey, there for the root of a diagram:
 *  its writing takes a branch's colour, so Spectrum reads as its theme and not as a grey page. The first branch that
 *  is neither red nor amber (what errors and Review Due are said in, in every theme), else its first branch, else the
 *  theme's own accent. */
export function writingAccentOf(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): string {
  const branches = (theme.palette ?? []).map((p) => p.stroke).filter(isArticleHex);
  const branch = branches.find((c) => !isWarmAccent(c)) ?? branches[0];
  return branch ?? themeAccent(theme);
}
