import {
  contrastRatio,
  isLightColor,
  legibleOn,
  shade,
  tint,
  type CanvasSurface,
  type ThemeDefinition,
} from '@livediagram/document';

// How an image element without a bitmap looks (docs/specs/009-elements/images.md "Placeholder
// rendering"): the empty placeholder, the broken-image state and the loading skeleton.
//
// Inked for the paper the element sits on (its page's where the page has a fill of its own, else
// the canvas's: useElementSurface), never for the app's light or dark chrome. A Tailwind `dark:`
// variant follows the chrome, so in dark chrome a light page (or a light-themed canvas) got the
// dark look: white text on a see-through grey over cream, all but invisible.
//
// Dressed in the tab's theme where the theme has colours of its own (imagePlaceholderTone), else
// the neutral slate below, as the Default theme leaves every element uncoloured.
//
// Every body is OPAQUE, so the ink's contrast is measured against the body alone and holds over
// any page fill, gradient or pattern underneath; a theme colour that falls short is pushed toward
// contrast (legibleOn). Hex values rather than Tailwind tokens: the brand and slate tokens are
// themselves redefined by the chrome's `.dark` class.

export type PlaceholderTone = {
  /** The box's body, opaque. */
  body: string;
  /** The dashed outline. */
  border: string;
  /** The icon and label. */
  ink: string;
  /** The outline and ink while an editor's pointer is over it (the double-click target). */
  hoverBorder: string;
  hoverInk: string;
};

export const IMAGE_PLACEHOLDER_TONE: Record<CanvasSurface, PlaceholderTone> = {
  light: {
    body: '#f8fafc', // slate-50
    border: '#64748b', // slate-500: 4.5:1 on the body
    ink: '#475569', // slate-600: 7.2:1 on the body
    hoverBorder: '#0284c7', // brand-600
    hoverInk: '#0369a1', // brand-700: 5.7:1 on the body
  },
  dark: {
    body: '#1e293b', // slate-800
    border: '#64748b', // slate-500: 3.1:1 on the body
    ink: '#e2e8f0', // slate-200: 11.9:1 on the body
    hoverBorder: '#38bdf8', // brand-400
    hoverInk: '#bae6fd', // brand-200: 11:1 on the body
  },
};

// WCAG AA for the icon and label; 3:1 for the dashed outline (a UI component's boundary).
export const PLACEHOLDER_INK_CONTRAST = 4.5;
export const PLACEHOLDER_BORDER_CONTRAST = 3;
// How far the accent is washed toward the paper for a body when the theme's own fill does not
// suit it: a pale tint on light paper, a deep shade on dark.
const BODY_TINT = 0.9;
const BODY_SHADE = 0.75;
// How far a hover pushes the accent toward contrast with the body.
const HOVER_PUSH = 0.3;
// A theme fill is used as the body only when it reads as the paper's lightness (the way legibleOn
// decides which way to push the ink) and the ink's far end (the app's near-black on light paper,
// white on dark) clears this against it, leaving room for AA ink of any hue.
const BODY_ROOM = 7;
const DEEPEST_INK = '#0f172a';

const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** The colours a theme dresses the placeholder in, or null for a theme with none of its own. */
export type PlaceholderThemeInk = { accent: string; fill: string | null; text: string | null };

export function placeholderThemeInk(
  theme: Pick<ThemeDefinition, 'elementFill' | 'elementStroke' | 'elementText' | 'palette'>,
): PlaceholderThemeInk | null {
  const first = theme.palette?.[0];
  const accent = isHex(theme.elementStroke)
    ? theme.elementStroke
    : isHex(first?.stroke)
      ? first.stroke
      : null;
  if (!accent) return null;
  const fill = isHex(theme.elementFill)
    ? theme.elementFill
    : isHex(first?.fill)
      ? first.fill
      : null;
  const text = isHex(theme.elementText)
    ? theme.elementText
    : isHex(first?.text)
      ? first.text
      : null;
  return { accent, fill, text };
}

/** The empty placeholder's colours on `surface` paper: the theme's where it has some, else slate. */
export function imagePlaceholderTone(
  surface: CanvasSurface,
  theme: PlaceholderThemeInk | null,
): PlaceholderTone {
  if (!theme) return IMAGE_PLACEHOLDER_TONE[surface];
  const light = surface === 'light';
  // The theme's own fill where it suits the paper (pale on light paper, deep on dark: far enough
  // from the ink's end that AA ink always exists), else the accent washed toward the paper.
  const body =
    theme.fill &&
    isLightColor(theme.fill) === light &&
    contrastRatio(theme.fill, light ? DEEPEST_INK : '#ffffff') >= BODY_ROOM
      ? theme.fill
      : light
        ? tint(theme.accent, BODY_TINT)
        : shade(theme.accent, BODY_SHADE);
  const towardContrast = (c: string) => (light ? shade(c, HOVER_PUSH) : tint(c, HOVER_PUSH));
  const hover = legibleOn(towardContrast(theme.accent), body, PLACEHOLDER_INK_CONTRAST);
  return {
    body,
    border: legibleOn(theme.accent, body, PLACEHOLDER_BORDER_CONTRAST),
    ink: legibleOn(theme.text ?? theme.accent, body, PLACEHOLDER_INK_CONTRAST),
    hoverBorder: hover,
    hoverInk: hover,
  };
}

/** The broken-image state ("Image unavailable"): rose, opaque, per paper. */
export const IMAGE_BROKEN_TONE: Record<
  CanvasSurface,
  Pick<PlaceholderTone, 'body' | 'border' | 'ink'>
> = {
  light: { body: '#fff1f2', border: '#fecdd3', ink: '#be123c' }, // rose-50 / 200 / 700
  dark: { body: '#3b1520', border: '#9f1239', ink: '#fda4af' }, // deep rose / rose-800 / rose-300
};

/** The loading skeleton's body, per paper. */
export const IMAGE_SKELETON_BODY: Record<CanvasSurface, string> = {
  light: '#f1f5f9', // slate-100
  dark: '#1e293b', // slate-800
};

// The label's size as a share of the box's shorter side: the label grows with the box so a big
// hero placeholder still reads at the zoom that fits its page, as its page's text does.
const LABEL_SHARE_OF_SIDE = 0.1;
// The label's bounds, in canvas px: never smaller than the old fixed 10px, never shouting.
export const PLACEHOLDER_LABEL_MIN_PX = 10;
export const PLACEHOLDER_LABEL_MAX_PX = 40;
// "Double-click to upload" is about 11 em wide: it takes one line when the box holds 12 em, else
// it wraps to two.
const LABEL_ONE_LINE_EMS = 12;
// The icon is twice the label, within these bounds and at most this share of the shorter side.
const ICON_TO_LABEL = 2;
const ICON_MIN_PX = 16;
const ICON_SHARE_OF_SIDE = 0.4;
// Line height and the border plus padding the label shares the box with.
const LINE_HEIGHT = 1.25;
const FRAME_PX = 12;

export type PlaceholderMetrics = {
  labelPx: number;
  iconPx: number;
  gapPx: number;
  /** False when the box is too small to hold the label under the icon: the icon shows alone. */
  showLabel: boolean;
};

/** The placeholder's icon and label sizes for a box of `width` x `height` canvas px. */
export function imagePlaceholderMetrics(width: number, height: number): PlaceholderMetrics {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const side = Math.min(w, h);
  const labelPx = Math.round(
    Math.min(
      PLACEHOLDER_LABEL_MAX_PX,
      Math.max(PLACEHOLDER_LABEL_MIN_PX, side * LABEL_SHARE_OF_SIDE),
    ),
  );
  const iconPx = Math.round(
    Math.max(ICON_MIN_PX, Math.min(labelPx * ICON_TO_LABEL, side * ICON_SHARE_OF_SIDE)),
  );
  const gapPx = Math.round(labelPx * 0.4);
  // Two lines when the label is wider than the box can hold on one.
  const lines = w - FRAME_PX >= labelPx * LABEL_ONE_LINE_EMS ? 1 : 2;
  const showLabel = h >= iconPx + gapPx + labelPx * LINE_HEIGHT * lines + FRAME_PX;
  return { labelPx, iconPx, gapPx, showLabel };
}
