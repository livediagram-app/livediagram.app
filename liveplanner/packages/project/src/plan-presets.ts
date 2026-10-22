// A board's and a sheet's style presets (docs/specs/010-palette/style-presets.md "Boards and sheets"): calm hues
// rather than the shape presets' accent ramps, which turned a whole board or sheet into a loud slab. A preset is
// stored as its id (`colorPreset`, prefixed `plan-`) and drawn for the surface it is on, so the same board reads as
// quiet paper on a light canvas and a quiet tint on a dark one, and follows a switch between them. The colours it
// also writes (for the tile and for anything that reads the element's own colours) are the light surface's.
import type { CanvasSurface } from './colors';
import { mixHex } from './svg-render-face-kit';

// Each preset's hue, quiet to warm. Neutral greys first, then the colours.
export const PLAN_PRESET_HUES = [
  { id: 'plan-slate', name: 'Slate', hue: '#64748b' },
  { id: 'plan-stone', name: 'Stone', hue: '#78716c' },
  { id: 'plan-sky', name: 'Sky', hue: '#0284c7' },
  { id: 'plan-teal', name: 'Teal', hue: '#0d9488' },
  { id: 'plan-sage', name: 'Sage', hue: '#4d7c0f' },
  { id: 'plan-amber', name: 'Amber', hue: '#b45309' },
  { id: 'plan-rose', name: 'Rose', hue: '#be123c' },
  { id: 'plan-lavender', name: 'Lavender', hue: '#7c3aed' },
] as const;

type PlanPresetId = (typeof PLAN_PRESET_HUES)[number]['id'];

type PlanPresetColours = { fill: string; stroke: string; text: string; hue: string };

// The papers and inks the hues are mixed into: the Plan palette's own neutral surfaces and text.
const LIGHT_PAPER = '#ffffff';
const LIGHT_INK = '#0f172a';
const DARK_PAPER = '#111827';
const DARK_INK = '#e2e8f0';

// How much of the hue each part takes. Low on purpose: a board is a big surface, so a whisper of colour reads;
// the border carries the hue, the ink only leans toward it, and ink always clears 4.5:1 on its fill.
const MIX = {
  light: { fill: 0.06, stroke: 0.35, text: 0.2 },
  dark: { fill: 0.14, stroke: 0.45, text: 0.12 },
} as const;

export function isPlanPresetId(id: string | null | undefined): id is PlanPresetId {
  return !!id && PLAN_PRESET_HUES.some((p) => p.id === id);
}

// A preset's colours on a surface, or null for an id that is not one.
export function planPresetColours(
  id: string | null | undefined,
  surface: CanvasSurface,
): PlanPresetColours | null {
  const preset = PLAN_PRESET_HUES.find((p) => p.id === id);
  if (!preset) return null;
  const mix = MIX[surface];
  const paper = surface === 'dark' ? DARK_PAPER : LIGHT_PAPER;
  const ink = surface === 'dark' ? DARK_INK : LIGHT_INK;
  return {
    fill: mixHex(preset.hue, paper, mix.fill),
    stroke: mixHex(preset.hue, paper, mix.stroke),
    text: mixHex(preset.hue, ink, mix.text),
    hue: preset.hue,
  };
}

// The presets as a grid of tiles on a surface.
export function planColorPresets(
  surface: CanvasSurface,
): { id: PlanPresetId; name: string; fill: string; stroke: string; text: string }[] {
  return PLAN_PRESET_HUES.map((p) => {
    const c = planPresetColours(p.id, surface)!;
    return { id: p.id, name: p.name, fill: c.fill, stroke: c.stroke, text: c.text };
  });
}
