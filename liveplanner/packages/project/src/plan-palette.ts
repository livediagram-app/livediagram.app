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

// A Risk field's levels (docs/specs/026-plan/item-types.md "Risk"), fixed in every plan, light and dark alike: Critical,
// High and Medium are Priority's Urgent, High and Medium; Low is green, as a low risk reads as safe.
export const RISK_COLOURS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
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
  // A light board's card is near white on its tinted list; a dark board's sits a step deeper than the board, as the
  // neutral dark set's does, so it stands off its list (4% toward the ink, as it was, left it 1.1:1 on a brown list).
  const card = light ? mixHex('#ffffff', paper, 0.75) : mixHex('#000000', paper, DARK_CARD_DEPTH);
  return {
    surface: paper,
    border,
    column,
    card,
    cardBorder: leanUntil(mixHex(border, paper, 0.55), text, [card], CARD_EDGE_CONTRAST),
    text,
    muted: readableMuted(text, paper, [column, card, paper]),
    warning: light ? LIGHT.warning : DARK.warning,
    warningBg: light ? LIGHT.warningBg : DARK.warningBg,
    // The accent labels buttons and notices on the column, so it reads there as text does.
    focus: leanUntil(stroke ?? base.focus, text, [column, card, paper], INK_CONTRAST),
  };
}

// How far a dark board's card sits toward black, and the least contrast a card's edge keeps on the card.
const DARK_CARD_DEPTH = 0.18;
const CARD_EDGE_CONTRAST = 1.3;

// `colour` as it is where it reaches `target` on every fill, else leaned toward `toward` a step at a time until it does.
function leanUntil(
  colour: string,
  toward: string,
  fills: readonly string[],
  target: number,
): string {
  for (let share = 0; share < 1; share += MUTED_STEP) {
    const leaned = share === 0 ? colour : mixHex(toward, colour, share);
    if (fills.every((f) => contrastRatio(leaned, f) >= target)) return leaned;
  }
  return toward;
}

// A type accent in the app's own dark chrome (docs/specs/026-plan/item-types.md "An item type"): one too dark to see
// (Project's black) is lifted toward white until it reaches 3:1 against the neutral dark card.
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

// The accent a board draws on its own card (docs/specs/026-plan/plan-board.md "Theme and style"): as chosen where it
// reaches 3:1 on that card, else leaned toward white on a dark card and black on a light one until it does. Measured on
// the board's card, not the neutral one, so a type's colour still reads on a coloured theme's card.
export function accentOn(color: string, palette: Pick<PlanPalette, 'card'>): string {
  return remembered(`a|${color}|${palette.card}`, () => {
    if (!hex(color) || !hex(palette.card)) return color;
    const away = isLightColor(palette.card) ? '#000000' : '#ffffff';
    return leanUntil(color, away, [palette.card], ACCENT_CONTRAST);
  });
}

// What accentOn and chipInkOn answered, by their colours: every card of a board asks the same few (its types', its
// labels', its priorities' on the board's one card colour), and working each out afresh on every card took about
// 100 ms a redraw of a 2,000-card board (docs/specs/026-plan/plan-board.md "A busy board"). Bounded: emptied when full,
// so a session of theme picks never grows it past PLAN_INK_MEMO_MAX.
export const PLAN_INK_MEMO_MAX = 2048;
const inkMemo = new Map<string, string>();
function remembered(key: string, work: () => string): string {
  const known = inkMemo.get(key);
  if (known !== undefined) return known;
  if (inkMemo.size >= PLAN_INK_MEMO_MAX) inkMemo.clear();
  const answer = work();
  inkMemo.set(key, answer);
  return answer;
}

// How much of its colour a chip's fill takes over the card (plan-card-parts.tsx `tint`).
export const PLAN_CHIP_TINT = 0.14;

// Coloured words on a card (a type chip's name, a label, the priority's name, a due pill): as chosen where they reach
// 4.5:1 on their chip (the colour's tint over the card), else leaned toward the card's ink until they do.
export function chipInkOn(color: string, palette: Pick<PlanPalette, 'card' | 'text'>): string {
  return remembered(`c|${color}|${palette.card}|${palette.text}`, () => {
    if (!hex(color) || !hex(palette.card) || !hex(palette.text)) return color;
    for (let share = 0; share < 1; share += MUTED_STEP) {
      const ink = share === 0 ? color : mixHex(palette.text, color, share);
      if (contrastRatio(ink, mixHex(ink, palette.card, PLAN_CHIP_TINT)) >= INK_CONTRAST) return ink;
    }
    return palette.text;
  });
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
