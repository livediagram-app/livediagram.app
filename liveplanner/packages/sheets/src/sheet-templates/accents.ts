// The accents a sheet template is drawn in (docs/specs/029-sheets/sheet.md "Sheet templates"): each a colour family
// (Tailwind's, by step) worked into the tints a template's cells take on a light or a dark canvas. Cell colours are
// fixed once written (a cell holds hex, never a theme token), so a template is tinted for the canvas it is made on, as
// Setup Sheet's looks are.

export const SHEET_ACCENTS = [
  'emerald',
  'violet',
  'sky',
  'indigo',
  'blue',
  'amber',
  'teal',
  'orange',
  'rose',
  'purple',
  'cyan',
  'fuchsia',
] as const;
export type SheetAccent = (typeof SHEET_ACCENTS)[number];

// Each family's 300, 500, 700 and 800 steps.
const FAMILIES: Record<SheetAccent, readonly [string, string, string, string]> = {
  emerald: ['#6ee7b7', '#10b981', '#047857', '#065f46'],
  violet: ['#c4b5fd', '#8b5cf6', '#6d28d9', '#5b21b6'],
  sky: ['#7dd3fc', '#0ea5e9', '#0369a1', '#075985'],
  indigo: ['#a5b4fc', '#6366f1', '#4338ca', '#3730a3'],
  blue: ['#93c5fd', '#3b82f6', '#1d4ed8', '#1e40af'],
  amber: ['#fcd34d', '#f59e0b', '#b45309', '#92400e'],
  teal: ['#5eead4', '#14b8a6', '#0f766e', '#115e59'],
  orange: ['#fdba74', '#f97316', '#c2410c', '#9a3412'],
  rose: ['#fda4af', '#f43f5e', '#be123c', '#9f1239'],
  purple: ['#d8b4fe', '#a855f7', '#7e22ce', '#6b21a8'],
  cyan: ['#67e8f9', '#06b6d4', '#0e7490', '#155e75'],
  fuchsia: ['#f0abfc', '#d946ef', '#a21caf', '#86198f'],
};

// What a template's cells are tinted with.
export type TemplateTints = {
  // The title's and a result's ink, a section's rule and the total's top border.
  ink: string;
  rule: string;
  // The header row: its fill and its (white) text.
  head: string;
  headInk: string;
  // Every other body row (Banded), the total row's fill, a result's fill.
  band: string;
  total: string;
  // Quiet text: the subtitle, a field's label, a note.
  muted: string;
  // The cells meant to be typed over (a rate, an income): a soft yellow, as a spreadsheet marks its inputs.
  input: string;
  // Boxed's thin lines.
  line: string;
};

// The surfaces the tints are mixed against: a light canvas's white, a dark canvas's slate.
const LIGHT_SURFACE = '#ffffff';
const DARK_SURFACE = '#1e293b';

// `a` mixed into `b` by `t` (0 is `b`, 1 is `a`), as #rrggbb.
export function mixHex(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  let out = '#';
  for (let i = 0; i < 3; i++)
    out += Math.round(ch(a, i) * t + ch(b, i) * (1 - t))
      .toString(16)
      .padStart(2, '0');
  return out;
}

export function templateTints(accent: SheetAccent, dark: boolean): TemplateTints {
  const [c300, c500, c700, c800] = FAMILIES[accent];
  return dark
    ? {
        ink: c300,
        rule: c500,
        head: c800,
        headInk: '#ffffff',
        band: mixHex(c500, DARK_SURFACE, 0.12),
        total: mixHex(c500, DARK_SURFACE, 0.24),
        muted: '#94a3b8',
        input: '#3a3519',
        line: '#475569',
      }
    : {
        ink: c700,
        rule: c500,
        head: c700,
        headInk: '#ffffff',
        band: mixHex(c500, LIGHT_SURFACE, 0.07),
        total: mixHex(c500, LIGHT_SURFACE, 0.16),
        muted: '#64748b',
        input: '#fefce8',
        line: '#cbd5e1',
      };
}

// The accent's own colour (its 500), for the pictures that sell a template (Start Planning's preview art).
export function accentColour(accent: SheetAccent): string {
  return FAMILIES[accent][1];
}
// Its header fill on a light canvas (its 700).
export function accentHead(accent: SheetAccent): string {
  return FAMILIES[accent][2];
}

// The chart palette (@liveplanner/document's CHART_PALETTES, by id) a template's chart takes, in its accent's family.
export type TemplateChartPalette = 'forest' | 'ocean' | 'sunset' | 'berry';
const CHART_PALETTE: Record<SheetAccent, TemplateChartPalette> = {
  emerald: 'forest',
  teal: 'forest',
  sky: 'ocean',
  blue: 'ocean',
  indigo: 'ocean',
  cyan: 'ocean',
  amber: 'sunset',
  orange: 'sunset',
  rose: 'berry',
  violet: 'berry',
  purple: 'berry',
  fuchsia: 'berry',
};
export function accentChartPalette(accent: SheetAccent): TemplateChartPalette {
  return CHART_PALETTE[accent];
}
