// The accent a knowledgebase's theme gives its writing (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase
// Style"): lime for the product's own theme, every other theme's stroke (a multi-colour theme's first branch that is
// neither red nor amber). One copy for the editor and the public site (docs/specs/030-knowledgebase/publishing.md),
// read from the theme's light half so both appearances start from the same colour.
import { DEFAULT_SCHEME_ID, getBuiltInTheme } from '@liveworkspace/element-model/themes';
import { isArticleHex } from './article-flow';
import { themeAccent } from './page-default-background';

// brand-600 of the lime ramp: what the product's own theme paints the writing's accent in.
export const LIME_ACCENT = '#4d7c0f';

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

/** The theme's accent as a hex; lime for the product's own. */
export function knowledgeThemeAccent(themeId: string | undefined): string {
  if (!themeId || themeId === DEFAULT_SCHEME_ID) return LIME_ACCENT;
  const theme = getBuiltInTheme(themeId, 'light');
  // A multi-colour theme's own stroke is a neutral grey, there for the root of a diagram: its writing takes a
  // branch's colour, so Spectrum reads as its theme and not as a grey page. The first branch that is neither red
  // nor amber: those are what errors and Review Due are said in, in every theme.
  const branches = (theme.palette ?? []).map((p) => p.stroke).filter(isArticleHex);
  const branch = branches.find((c) => !isWarm(c)) ?? branches[0];
  return branch ?? themeAccent(theme);
}
