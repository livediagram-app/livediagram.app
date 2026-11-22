// What a Knowledgebase Style looks like (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): the
// accent its theme gives the writing and the chrome, the light ground a page stands on, and a tab drawn in the
// style. One copy for everything that draws a page away from the editor's own canvas: the editor's exports
// (lib/export-as-seen.ts), its print and look cards, and the api's preview (apps/api/src/thumbnail.ts), so the
// Explorer's picture of a knowledgebase is the look its readers see. Pure and DOM-free.
import { mixHex } from '@liveworkspace/model-core/color-wash';
import { DEFAULT_SCHEME_ID } from '@liveworkspace/element-model/themes';
import { contrastRatio, hexToRgb, shade, tint } from './colors';
import { articlesOf, isArticleHex } from './article-flow';
import { knowledgeArticleStyle, type KnowledgeStyle } from './knowledge-style';
import { themeAccent } from './page-default-background';
import { pagesOf } from './page';
import { getBuiltInTheme, themedForTab, type ThemeDefinition } from './themes';
import type { Tab } from './index';

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

// The light appearance's ground under the product's own theme.
export const KNOWLEDGE_LIGHT_GROUND = '#ffffff';

/** The ground a page stands on in the light appearance (page-surface.md "What a page looks like"): white under the
 *  product's own theme, and under any other a pale wash of its chrome accent, pale enough that every text colour
 *  keeps its contrast. The editor paints its white with it (hooks/ui/useEditorAccent.ts); the preview its page. */
export function knowledgeLightGround(themeId: string | undefined): string {
  const accent = knowledgeChromeAccent(themeId);
  return accent ? knowledgeGroundWash(accent) : KNOWLEDGE_LIGHT_GROUND;
}

/** The white ground washed with a chrome accent (knowledgeChromeAccent). */
export const knowledgeGroundWash = (accent: string): string =>
  mixHex(KNOWLEDGE_LIGHT_GROUND, accent, 0.94);

const styled = new WeakMap<Tab, { style: KnowledgeStyle; out: Tab }>();

/**
 * A tab as the knowledgebase's style draws it, for everything that draws a tab away from the editor's own canvas
 * (the exports, the print, the Explorer's preview): the tab with the knowledgebase's theme and typeface, each
 * article's writing in the knowledgebase's article style with the writing's accent (the picked one, else the
 * theme's: lime for the product's own, a multi-colour theme's branch), and each colour an element leaves unset in
 * the theme's ("Drawings and charts"). A view only: nothing here is stored or saved. The same tab back for the same
 * tab and style.
 */
export function tabInKnowledgeStyle(tab: Tab, style: KnowledgeStyle): Tab {
  const hit = styled.get(tab);
  if (hit && hit.style === style) return hit.out;
  const article = { ...knowledgeArticleStyle(style), accent: knowledgeWritingAccent(style) };
  const flows = Object.entries(articlesOf(tab));
  const out: Tab = {
    ...tab,
    theme: style.theme,
    font: style.bodyFont,
    elements: themedForTab(tab.elements, style.theme),
    ...(flows.length
      ? {
          articles: Object.fromEntries(
            flows.map(([flow, doc]) => [flow, { ...doc, style: article }]),
          ),
        }
      : {}),
  };
  styled.set(tab, { style, out });
  return out;
}

/** The tab with each page that has no fill of its own standing on the style's light ground (knowledgeLightGround),
 *  as the page reads in the editor: for a picture of the page away from it (the Explorer's preview). The stored
 *  pages carry no paint of their own (./page-looks), so this is a view too. The same tab under the product's own
 *  theme, whose ground is the plain white paper. */
export function tabOnKnowledgeGround(tab: Tab, style: Pick<KnowledgeStyle, 'theme'>): Tab {
  const ground = knowledgeLightGround(style.theme);
  if (ground === KNOWLEDGE_LIGHT_GROUND) return tab;
  // As the pages are read (pagesOf), so a tab stored with no page list stands on the ground too.
  const pages = pagesOf(tab).map((p) =>
    p.background?.fill
      ? p
      : { ...p, background: { ...p.background, fill: { kind: 'solid' as const, color: ground } } },
  );
  return { ...tab, pages };
}
