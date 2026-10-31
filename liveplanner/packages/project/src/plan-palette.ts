// The Plan board's and Plan card's colours (docs/specs/026-plan/plan-board.md "Theme and style"): the
// canvas and the SVG export both draw from here, so a board looks the same in both. With no colours of
// its own a board takes the surface's neutral set; with them (a tab theme stamps them, Quick Style and
// the colour pickers set them, a theme switch rewrites them) its fill is the board, its stroke the
// focus and (mixed into the fill) the border, its text the ink, and the columns, cards and muted ink are mixed from those. Ink
// that would not read on the fill is swapped for a readable one.
import { contrastRatio, hexToRgb, isLightColor, type CanvasSurface } from './colors';
import { mixHex } from './svg-render-face-kit';
import { planPresetColours } from './plan-presets';

// A card's priority dot and tint, the same on the canvas and in the export: they read as urgency, not
// as theme.
export const PRIORITY_COLOURS = {
  urgent: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#64748b',
} as const;

// A flagged card's flag (docs/specs/026-plan/items.md "Flags"), on the canvas and in the export alike.
export const FLAG_COLOUR = '#e11d48';

export type PlanPalette = {
  surface: string;
  border: string;
  column: string;
  card: string;
  cardBorder: string;
  text: string;
  muted: string;
  warning: string;
  warningBg: string;
  focus: string;
};

// What the element itself says: its fill, stroke and text colours, each absent when unset, and its style preset
// (`colorPreset`): a board or sheet preset (plan-presets.ts) is drawn for the surface, over the colours it wrote.
export type PlanOwnColours = {
  fill?: string | null;
  stroke?: string | null;
  text?: string | null;
  preset?: string | null;
};

// A board's, view's, card's or sheet's own colours, as planPalette reads them.
export const planOwnColoursOf = (el: {
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  colorPreset?: string;
}): PlanOwnColours => ({
  fill: el.fillColor,
  stroke: el.strokeColor,
  text: el.textColor,
  preset: el.colorPreset,
});

const DARK: PlanPalette = {
  surface: '#111827',
  border: '#334155',
  column: '#1e293b',
  card: '#0f172a',
  cardBorder: '#334155',
  text: '#e2e8f0',
  muted: '#94a3b8',
  warning: '#fbbf24',
  warningBg: 'rgba(251, 191, 36, 0.14)',
  focus: '#a78bfa', // brand violet-400
};

const LIGHT: PlanPalette = {
  surface: '#f8fafc',
  border: '#e2e8f0',
  column: '#f1f5f9',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  // Slate 500 leaned 8% toward the ink: 4.8:1 on the column (slate 500 itself was 4.3:1), so muted words read at AA.
  muted: '#5d6d83',
  warning: '#b45309',
  warningBg: 'rgba(180, 83, 9, 0.1)',
  focus: '#7c3aed', // brand violet-600
};

// Readable ink reaches this contrast on its fill (WCAG AA for body text).
const INK_CONTRAST = 4.5;

// Muted ink starts at this share of the ink, mixed into the paper, and leans further toward the ink, a step at a
// time, until it reads at INK_CONTRAST on every fill it sits on (the column, a card and the board): at 62% every
// preset's muted words fell to about 3.8:1 in light and 4.2:1 in dark.
const MUTED_SHARE = 0.62;
const MUTED_STEP = 0.04;

function readableMuted(text: string, paper: string, fills: readonly string[]): string {
  for (let share = MUTED_SHARE; share < 1; share += MUTED_STEP) {
    const muted = mixHex(text, paper, share);
    if (fills.every((f) => contrastRatio(muted, f) >= INK_CONTRAST)) return muted;
  }
  return text;
}

const hex = (v: string | null | undefined): string | undefined =>
  v && hexToRgb(v) ? v : undefined;

/** How much of an accent a board's, sheet's or start panel's border keeps, mixed into its paper. */
export const PLAN_BORDER_ACCENT_SHARE = 0.35;

export function planPalette(surface: CanvasSurface, own: PlanOwnColours = {}): PlanPalette {
  const base = surface === 'dark' ? DARK : LIGHT;
  const preset = planPresetColours(own.preset, surface);
  const fill = preset?.fill ?? hex(own.fill);
  const stroke = preset?.stroke ?? hex(own.stroke);
  const ink = preset?.text ?? hex(own.text);
  if (!fill && !stroke && !ink) return base;
  const paper = fill ?? base.surface;
  const light = isLightColor(paper);
  const wanted = ink ?? base.text;
  const text =
    contrastRatio(wanted, paper) >= INK_CONTRAST ? wanted : light ? LIGHT.text : DARK.text;
  // An accent border is mixed into the paper (PLAN_BORDER_ACCENT_SHARE): at a board's or sheet's size the full accent
  // reads heavy, so the lines stay quiet and the full accent is kept for focus.
  const border = stroke
    ? mixHex(stroke, paper, PLAN_BORDER_ACCENT_SHARE)
    : fill
      ? mixHex(text, paper, 0.16)
      : base.border;
  const column = mixHex(text, paper, light ? 0.05 : 0.08);
  const card = light ? mixHex('#ffffff', paper, 0.75) : mixHex(text, paper, 0.04);
  return {
    surface: paper,
    border,
    column,
    card,
    cardBorder: mixHex(border, paper, 0.55),
    text,
    muted: readableMuted(text, paper, [column, card, paper]),
    warning: light ? LIGHT.warning : DARK.warning,
    warningBg: light ? LIGHT.warningBg : DARK.warningBg,
    focus: stroke ?? base.focus,
  };
}

// A type accent on a dark surface (docs/specs/026-plan/item-types.md "An item type"): one too dark to
// see (Project's black) is lifted toward white until it reaches 3:1 against the dark card; a
// light surface keeps the accent as chosen.
const DARK_CARD = DARK.card;
const ACCENT_CONTRAST = 3;
const LIFT_STEP = 0.1;

export function liftAccent(color: string): string {
  if (!hexToRgb(color) || contrastRatio(color, DARK_CARD) >= ACCENT_CONTRAST) return color;
  for (let share = LIFT_STEP; share <= 1; share += LIFT_STEP) {
    const lifted = mixHex('#ffffff', color, share);
    if (contrastRatio(lifted, DARK_CARD) >= ACCENT_CONTRAST) return lifted;
  }
  return '#ffffff';
}

// The accent a card face draws on its palette: lifted on a dark card.
export function accentOn(color: string, palette: Pick<PlanPalette, 'card'>): string {
  return isLightColor(palette.card) ? color : liftAccent(color);
}

// A Percent field's bar on a card face (docs/specs/026-plan/item-types.md "Percent"): its size, its fill (the board's
// accent, lifted on a dark card) and its track (the muted ink, quiet on the chip's column ground). One answer for the
// canvas's chip and the export's, so both draw the same bar.
export const PLAN_PERCENT_BAR = { width: 32, height: 4 } as const;
export function planPercentInks(palette: PlanPalette): { fill: string; track: string } {
  return {
    fill: accentOn(palette.focus, palette),
    track: mixHex(palette.muted, palette.column, 0.3),
  };
}
