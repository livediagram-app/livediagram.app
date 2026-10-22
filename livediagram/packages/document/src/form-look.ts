// A form's look (docs/specs/030-forms/forms.md "Look"): its tab's theme, finish, font and canvas style, as the builder
// and the form link's page both draw it. Its colour is always the theme's own; each half (light, dark) is worked out so the page
// can follow the respondent's system.
import { contrastRatio } from './colors';
import { resolveFinish, type Finish } from './finish';
import { resolveFontStack } from './fonts';
import { themeAccent } from './theme-accent';
import { DEFAULT_PATTERN_COLOR } from './canvas-colors';
import { isBackgroundPattern, type BackgroundPattern, type Tab } from './index';
import { themeHalf, viewBackdropInTheme } from './theme-halves';
import { DEFAULT_SCHEME_LIGHT, THEMES } from './themes-data';
import { getBuiltInTheme, type Appearance, type ThemeDefinition } from './themes';

/** A colour for each half of the page. */
export type FormHalves = { light: string; dark: string };

export type FormLook = {
  // The theme's canvas colour, behind the form.
  backdrop: FormHalves;
  // The form's colour: the cover, bars, buttons, focus rings and links.
  accent: FormHalves;
  // Text drawn on the accent (a filled button's label).
  onAccent: FormHalves;
  // How boxes are drawn: Flexible as they are, Professional square and fine, Sketch by hand, Marker in felt-tip.
  finish: Finish;
  // The tab font's id, when the tab has one the catalogue knows.
  font?: string;
  // The tab's canvas style behind the form, when someone picked one (a Form tab's own default is a plain canvas).
  canvas?: FormCanvas;
};

/** A canvas style as a form draws it: the pattern in each half's colour, at the tab's size, speed and strength. */
export type FormCanvas = {
  pattern: BackgroundPattern;
  color: FormHalves;
  // The pattern-size slider (0.5 to 2); absent at 1.
  scale?: number;
  // An animated pattern's speed (0.25 to 3); absent at 1.
  speed?: number;
  // The canvas strength slider (0 to 1); absent at 1.
  opacity?: number;
};

type CanvasTab = Pick<
  Tab,
  | 'theme'
  | 'backgroundPattern'
  | 'patternColor'
  | 'backgroundPatternScale'
  | 'backgroundAnimationSpeed'
  | 'backgroundOpacity'
>;

// A slider's value kept to its range; absent at its default (1) or when it is no number.
function slider(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const v = Math.min(max, Math.max(min, value));
  return v === 1 ? undefined : v;
}

// The canvas a Form tab shows (resolveViewBackdrop in Plan mode): Plan's plain canvas while the tab's pattern is still
// its theme's, else the pattern someone picked, its colour in each half as the editor draws it (a colour the theme
// painted follows the half; a picked colour stays). A custom theme reads as Default, as the rest of the look does.
function formCanvas(tab: CanvasTab): FormCanvas | undefined {
  const pattern = tab.backgroundPattern;
  if (!isBackgroundPattern(pattern) || pattern === 'blank') return undefined;
  const light = getBuiltInTheme(tab.theme, 'light');
  const dark = getBuiltInTheme(tab.theme, 'dark');
  if (pattern === light.backgroundPattern || pattern === dark.backgroundPattern) return undefined;
  const source = THEMES.find((t) => t.id === tab.theme) ?? DEFAULT_SCHEME_LIGHT;
  const stored = {
    backgroundColor: themeHalf(source, 'light').backgroundColor,
    patternColor: tab.patternColor ?? DEFAULT_PATTERN_COLOR,
  };
  const half = (appearance: Appearance) =>
    viewBackdropInTheme(stored, source, appearance).patternColor;
  const scale = slider(tab.backgroundPatternScale, 0.5, 2);
  const speed = slider(tab.backgroundAnimationSpeed, 0.25, 3);
  const opacity = slider(tab.backgroundOpacity, 0, 1);
  return {
    pattern,
    color: { light: half('light'), dark: half('dark') },
    ...(scale !== undefined ? { scale } : {}),
    ...(speed !== undefined ? { speed } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
  };
}

// The Default theme leaves its colours to the type defaults; a form on it is drawn in the brand blue of each half. The
// light half is sky-700, which carries a white label at 5.9:1: sky-600 reached neither white (4.1:1) nor dark (4.4:1).
const BRAND: FormHalves = { light: '#0369a1', dark: '#38bdf8' };

// A filled button's label: whichever of white and slate-900 reads better on the accent. A brightness cut-off picked
// light text on mid-tones it could not carry (Pumpkin's orange and Evergreen's coral, 2.5:1).
const LABEL_LIGHT = '#ffffff';
const LABEL_DARK = '#0f172a';
export function formLabelOn(accent: string): string {
  return contrastRatio(LABEL_LIGHT, accent) >= contrastRatio(LABEL_DARK, accent)
    ? LABEL_LIGHT
    : LABEL_DARK;
}

const accentOf = (theme: ThemeDefinition, appearance: Appearance) =>
  theme.elementStroke || theme.palette?.length ? themeAccent(theme) : BRAND[appearance];

/** The look of a form on a tab with this theme, finish and font. A custom theme draws as Default (as the public
 *  page cannot read its owner's themes, the builder draws it the same way). */
export function formLook(tab: CanvasTab & { finish?: unknown; font?: string }): FormLook {
  const half = (appearance: Appearance) => getBuiltInTheme(tab.theme, appearance);
  const light = half('light');
  const dark = half('dark');
  const accent: FormHalves = { light: accentOf(light, 'light'), dark: accentOf(dark, 'dark') };
  const canvas = formCanvas(tab);
  return {
    backdrop: { light: light.backgroundColor, dark: dark.backgroundColor },
    accent,
    onAccent: { light: formLabelOn(accent.light), dark: formLabelOn(accent.dark) },
    finish: resolveFinish(undefined, tab.finish),
    ...(resolveFontStack(tab.font) ? { font: tab.font } : {}),
    ...(canvas ? { canvas } : {}),
  };
}
