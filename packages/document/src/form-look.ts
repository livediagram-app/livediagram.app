// A form's look (docs/specs/030-forms/forms.md "Look"): its tab's theme, finish and font, as the builder and the form
// link's page both draw it. The accent is the theme's own colour unless the form chose one; each half (light, dark)
// is worked out so the page can follow the respondent's system.
import { deriveTextColorForBg } from './colors';
import { resolveFinish, type Finish } from './finish';
import { resolveFontStack } from './fonts';
import { themeAccent } from './page-default-background';
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
  // How boxes are drawn: Flexible as they are, Professional square and fine, Sketch by hand.
  finish: Finish;
  // The tab font's id, when the tab has one the catalogue knows.
  font?: string;
};

// The Default theme leaves its colours to the type defaults; a form on it is drawn in the brand blue of each half, which
// carries a light label (the shared theme accent's lighter fallback would not).
const BRAND: FormHalves = { light: '#0284c7', dark: '#38bdf8' };

const accentOf = (theme: ThemeDefinition, appearance: Appearance) =>
  theme.elementStroke || theme.palette?.length ? themeAccent(theme) : BRAND[appearance];

/** The look of a form on a tab with this theme, finish and font. A custom theme draws as Default (as the public
 *  page cannot read its owner's themes, the builder draws it the same way). */
export function formLook(
  tab: { theme?: string; finish?: unknown; font?: string },
  form: { accent?: string },
): FormLook {
  const half = (appearance: Appearance) => getBuiltInTheme(tab.theme, appearance);
  const light = half('light');
  const dark = half('dark');
  const accent: FormHalves = form.accent
    ? { light: form.accent, dark: form.accent }
    : { light: accentOf(light, 'light'), dark: accentOf(dark, 'dark') };
  return {
    backdrop: { light: light.backgroundColor, dark: dark.backgroundColor },
    accent,
    onAccent: {
      light: deriveTextColorForBg(accent.light),
      dark: deriveTextColorForBg(accent.dark),
    },
    finish: resolveFinish(undefined, tab.finish),
    ...(resolveFontStack(tab.font) ? { font: tab.font } : {}),
  };
}
