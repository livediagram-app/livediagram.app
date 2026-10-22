// A start panel's colours (docs/specs/007-editor/start-diagramming.md "Look"): the tab's own, so the panel reads as
// part of the canvas it sits on. Its paper is the tab's canvas colour, its accent (the chosen category, the focus, a
// card's hover) the theme's stroke, its ink the theme's text; the rest is mixed from those, keeping the ink readable
// on the paper. A theme with no colours of its own (Default) leaves the panel the app's light or dark look. The tours
// draw from the same palette.
import {
  contrastRatio,
  hexToRgb,
  isLightColor,
  mixHex,
  type CanvasSurface,
  type Tab,
  type ThemeDefinition,
} from '@livepages/document';

export type StartPalette = {
  surface: string;
  border: string;
  column: string;
  card: string;
  text: string;
  muted: string;
  focus: string;
};

// The tab's own colours, each absent when the theme has none.
export type StartOwnColours = {
  fill?: string | null;
  stroke?: string | null;
  text?: string | null;
};

const DARK: StartPalette = {
  surface: '#111827',
  border: '#334155',
  column: '#1e293b',
  card: '#0f172a',
  text: '#e2e8f0',
  muted: '#94a3b8',
  focus: '#60a5fa',
};

const LIGHT: StartPalette = {
  surface: '#f8fafc',
  border: '#e2e8f0',
  column: '#f1f5f9',
  card: '#ffffff',
  text: '#0f172a',
  // Slate 500 leaned 8% toward the ink: 4.8:1 on the column (slate 500 itself was 4.3:1), so muted words read at AA.
  muted: '#5d6d83',
  focus: '#2563eb',
};

// Readable ink reaches this contrast on its fill (WCAG AA for body text).
const INK_CONTRAST = 4.5;

// Muted ink starts at this share of the ink, mixed into the paper, and leans further toward the ink a step at a time
// until it reads at INK_CONTRAST on every fill it sits on.
const MUTED_SHARE = 0.62;
const MUTED_STEP = 0.04;

// How much of the accent the border keeps, mixed into the paper: the full accent reads heavy at a panel's size, so the
// lines stay quiet and the full accent is kept for focus.
const BORDER_ACCENT_SHARE = 0.35;

function readableMuted(text: string, paper: string, fills: readonly string[]): string {
  for (let share = MUTED_SHARE; share < 1; share += MUTED_STEP) {
    const muted = mixHex(text, paper, share);
    if (fills.every((f) => contrastRatio(muted, f) >= INK_CONTRAST)) return muted;
  }
  return text;
}

const hex = (v: string | null | undefined): string | undefined =>
  v && hexToRgb(v) ? v : undefined;

export function startPalette(surface: CanvasSurface, own: StartOwnColours = {}): StartPalette {
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
  const border = stroke
    ? mixHex(stroke, paper, BORDER_ACCENT_SHARE)
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
    text,
    muted: readableMuted(text, paper, [column, card, paper]),
    focus: stroke ?? base.focus,
  };
}

export function startPanelColours(
  tab: Pick<Tab, 'backgroundColor'>,
  theme: Pick<
    ThemeDefinition,
    'backgroundColor' | 'elementStroke' | 'elementText' | 'rootColor' | 'palette'
  >,
): StartOwnColours {
  const accent = theme.elementStroke ?? theme.rootColor?.stroke ?? theme.palette?.[0]?.stroke;
  // An unthemed tab (no accent of its own) keeps the app's own look rather than a near-copy of it.
  if (!accent) return {};
  return {
    fill: tab.backgroundColor ?? theme.backgroundColor,
    stroke: accent,
    text: theme.elementText ?? theme.rootColor?.text ?? null,
  };
}
