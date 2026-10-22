// A form cover's paint (docs/specs/030-forms/forms.md "The form card, top to bottom", Cover): its fills and motions,
// fills compared by value, the tone a fill reads as, the ink its pattern takes, and the theme colours its gradients are
// drawn from. Pure. The stored shape is @livediagram/forms' FormCover; @livediagram/page-background validates what is
// stored, and the motions offered are lib/form-cover/cover-motion.ts's catalogue.
import type { FormCover } from '@livediagram/forms';
import { isLightColor, shade, themeAccent, type ThemeDefinition } from '@livediagram/document';

export { FALLBACK_THEME_ACCENT, themeAccent } from '@livediagram/document';

export type ColourBackground = FormCover;
export type PageColourFill = NonNullable<FormCover['fill']>;
export type PagePattern = NonNullable<FormCover['pattern']>;
export type PageMotion = NonNullable<Extract<PageColourFill, { kind: 'gradient' }>['motion']>;

// A motion's speed: a rate on its own pace.
export const PAGE_MOTION_SPEED_MIN = 0.25;
export const PAGE_MOTION_SPEED_MAX = 3;
export const PAGE_PATTERNS: readonly PagePattern[] = ['dots', 'grid', 'lines'];

// CSS degrees: 180 runs top to bottom, so 160 leans the run toward the bottom right.
export const PAGE_GRADIENT_ANGLE = 160;

// The pattern's pitch, in px (the dots, grid and lines).
export const PAGE_PATTERN_PITCH = 24;

// Mist: the accent tinted this far toward white at the top, and this far at the bottom. Light
// enough that the default dark ink stays well past AA; the Gradient category's Theme Mist.
export const MIST_TOP_TINT = 0.95;
export const MIST_BOTTOM_TINT = 0.72;
// Dusk: the accent shaded this far toward black at the top, the second colour this far at the
// bottom; the Gradient category's Theme Dusk.
export const DUSK_TOP_SHADE = 0.65;
export const DUSK_BOTTOM_SHADE = 0.4;
// Steel: the Gradient category's Steel, a cool light grey.
export const STEEL_GRADIENT = { from: '#f1f5f9', to: '#cbd5e1' } as const;

const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** The theme's second and third colours (a multi-colour theme's next branches, else the accent
 *  deepened), for the theme gradients. */
export function themeSecondaries(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): [string, string] {
  const a = themeAccent(theme);
  const b = isHex(theme.palette?.[1]?.stroke) ? theme.palette[1].stroke : shade(a, 0.25);
  const c = isHex(theme.palette?.[2]?.stroke) ? theme.palette[2].stroke : shade(a, 0.45);
  return [b, c];
}

/** Whether two fills are the same (a preset's swatch shows as chosen). */
export function sameFill(a: PageColourFill | undefined, b: PageColourFill | undefined): boolean {
  if (!a || !b) return !a && !b;
  if (a.kind === 'solid' && b.kind === 'solid')
    return a.color.toLowerCase() === b.color.toLowerCase();
  if (a.kind === 'gradient' && b.kind === 'gradient') {
    return (
      a.from === b.from &&
      a.to === b.to &&
      a.angle === b.angle &&
      a.motion === b.motion &&
      (a.speed ?? 1) === (b.speed ?? 1)
    );
  }
  return false;
}

/** The colour a fill reads as: a solid's colour, a gradient's two stops averaged. */
export function fillTone(fill: PageColourFill): string {
  if (fill.kind === 'solid') return fill.color;
  const rgb = (hex: string) => {
    const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const a = rgb(fill.from);
  const b = rgb(fill.to);
  return (
    '#' +
    a
      .map((v, i) =>
        Math.round((v + b[i]!) / 2)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Whether a background's fill is dark: what is drawn on it takes light ink. */
export function pageIsDark({ background }: { background?: ColourBackground }): boolean {
  const fill = background?.fill;
  return !!fill && !isLightColor(fillTone(fill));
}

/** The pattern's ink: faint white on a dark fill, faint slate on a light one (and on the plain
 *  paper). */
export function pagePatternInk(background: ColourBackground | undefined): string {
  return pageIsDark({ background }) ? 'rgb(255 255 255 / 0.14)' : 'rgb(15 23 42 / 0.1)';
}
