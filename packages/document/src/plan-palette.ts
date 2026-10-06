// The Plan board's and Plan card's colours (docs/specs/026-plan/plan-board.md "Theme and style"): the
// canvas and the SVG export both draw from here, so a board looks the same in both. With no colours of
// its own a board takes the surface's neutral set; with them (a tab theme stamps them, Quick Style and
// the colour pickers set them, a theme switch rewrites them) its fill is the board, its stroke the
// border and focus, its text the ink, and the columns, cards and muted ink are mixed from those. Ink
// that would not read on the fill is swapped for a readable one.
import { contrastRatio, hexToRgb, isLightColor, type CanvasSurface } from './colors';
import { mixHex } from './svg-render-face-kit';

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

// What the element itself says: its fill, stroke and text colours, each absent when unset.
export type PlanOwnColours = {
  fill?: string | null;
  stroke?: string | null;
  text?: string | null;
};

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
  focus: '#60a5fa',
};

const LIGHT: PlanPalette = {
  surface: '#f8fafc',
  border: '#e2e8f0',
  column: '#f1f5f9',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  warning: '#b45309',
  warningBg: 'rgba(180, 83, 9, 0.1)',
  focus: '#2563eb',
};

// Readable ink reaches this contrast on its fill (WCAG AA for body text).
const INK_CONTRAST = 4.5;

const hex = (v: string | null | undefined): string | undefined =>
  v && hexToRgb(v) ? v : undefined;

export function planPalette(surface: CanvasSurface, own: PlanOwnColours = {}): PlanPalette {
  const base = surface === 'dark' ? DARK : LIGHT;
  const fill = hex(own.fill);
  const stroke = hex(own.stroke);
  const ink = hex(own.text);
  if (!fill && !stroke && !ink) return base;
  const paper = fill ?? base.surface;
  const light = isLightColor(paper);
  const wanted = ink ?? base.text;
  const text =
    contrastRatio(wanted, paper) >= INK_CONTRAST ? wanted : light ? LIGHT.text : DARK.text;
  const border = stroke ?? (fill ? mixHex(text, paper, 0.16) : base.border);
  return {
    surface: paper,
    border,
    column: mixHex(text, paper, light ? 0.05 : 0.08),
    card: light ? mixHex('#ffffff', paper, 0.75) : mixHex(text, paper, 0.04),
    cardBorder: mixHex(border, paper, 0.55),
    text,
    muted: mixHex(text, paper, 0.62),
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
