import type { BorderStroke, BorderStyle } from './border-style';
import { isLightColor, shade, tint } from './colors';
import type { Element } from './index';
import type { ThemeDefinition } from './themes';

// Design-system defaults used when a theme defers its element colours
// (null = "use the built-in shape colours", e.g. the Basic theme). They
// mirror defaultFillColor / defaultStrokeColor / defaultTextColor for
// shapes (brand-50 / brand-500 / brand-800) so even a deferring theme
// yields an on-brand ramp rather than only neutrals.
const DEFAULT_SHAPE_FILL = '#f0f9ff';
const DEFAULT_SHAPE_STROKE = '#0ea5e9';
const DEFAULT_SHAPE_TEXT = '#075985';

// Preset colour swatches that relate to a theme — used by the context-menu
// colour pickers so the offered presets match the active theme rather than a
// fixed rainbow. The accent hue (and, for multi-colour themes, every branch
// hue) is spun into a light → base → dark RAMP so the user has several
// on-theme versions of the same colour one click away, not just the single
// theme colour. Pads with a neutral ramp so there's always a usable spread.
// Deduped (case-insensitive), capped for a tidy (free-wrapping) grid.
export function themePresetColors(theme: ThemeDefinition): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (c: string | null | undefined) => {
    if (!c) return;
    const key = c.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  // A hue → 4-step ramp (two tints, base, one shade): lighter versions
  // suit fills, the base + shade suit strokes / text.
  const ramp = (hex: string) => {
    push(tint(hex, 0.6));
    push(tint(hex, 0.3));
    push(hex);
    push(shade(hex, 0.3));
  };

  const stroke = theme.elementStroke ?? DEFAULT_SHAPE_STROKE;
  const fill = theme.elementFill ?? DEFAULT_SHAPE_FILL;
  const text = theme.elementText ?? DEFAULT_SHAPE_TEXT;

  if (theme.palette && theme.palette.length > 0) {
    // Multi-colour theme: lead with a tint + base for each branch hue so
    // every branch colour is reachable in two intensities.
    for (const entry of theme.palette) {
      push(tint(entry.stroke, 0.5));
      push(entry.stroke);
    }
    push(text);
  } else {
    // Single-accent theme: a full ramp of the accent, then fill + text.
    ramp(stroke);
    push(fill);
    push(text);
  }

  // Neutral ramp — always useful (white → light grey → slate → ink).
  push('#ffffff');
  push('#e2e8f0');
  push('#94a3b8');
  push('#475569');
  push('#0f172a');
  return out.slice(0, 20);
}

// A one-click shape style preset (spec/48): a complete look applied together —
// fill / stroke / text colour AND a matching border treatment (weight +
// pattern). Deliberately NOT the border radius: radius is a shape-silhouette
// choice the user makes separately, and presets clobbering it read as the
// preset "breaking" the shape. Derived from the active theme so the offered
// presets always match it, the same way themePresetColors derives the
// colour-picker swatches.
export type ShapeColorPreset = {
  // Stable identity for the preset, independent of the theme it's rendered
  // for (spec/48). Stored on a shape's `colorPreset` so a theme change can
  // re-derive the same variant for the new theme. The variants are fixed
  // tokens ('theme', the emphasis ramp 'ghost' | 'muted' | 'soft' | 'tinted' |
  // 'solid' | 'bold' | 'inked', the border treatments 'outline' | 'dotted' |
  // 'frame', and the semantic set 'info' | 'success' | 'warning' | 'danger');
  // multi-colour themes' per-branch cards are 'branch-<i>'. (A legacy 'pill'
  // binding from before radius left the presets simply stops re-deriving.)
  id: string;
  name: string;
  fill: string;
  stroke: string;
  text: string;
  // The border that belongs to this look. A preset is one complete style, so
  // the border isn't a separate choice: Bold carries a thick border, Outline a
  // dashed one, Frame a thick sharp one, etc. Applied + re-derived with the
  // colours.
  borderStroke: BorderStroke;
  borderStyle: BorderStyle;
};

// The on-theme style presets for a shape — each a complete look (colour +
// matching border weight/pattern), ordered hierarchically so the grid reads
// as tiers:
//   1. Theme — the current theme's own look (plus a card per branch hue on
//      multi-colour themes).
//   2. The emphasis ramp, quietest → loudest: Ghost, Muted, Soft, Tinted,
//      Solid, Bold, Inked.
//   3. Border treatments: Outline, Dotted, Frame.
//   4. Semantic status colours (theme-independent): Info, Success, Warning,
//      Danger.
// Filled variants pick a contrasting label colour (white on dark, a deep
// shade on light) so text stays readable. Deduped on the exact
// fill+stroke+text triple, capped at 20 (five 4-wide grid rows).
export function shapeColorPresets(theme: ThemeDefinition): ShapeColorPreset[] {
  const accent = theme.elementStroke ?? DEFAULT_SHAPE_STROKE;
  const baseFill = theme.elementFill ?? DEFAULT_SHAPE_FILL;
  const baseText = theme.elementText ?? DEFAULT_SHAPE_TEXT;
  // A readable label colour for a filled tile: white on a dark fill, a deep
  // shade of the fill on a light one.
  const labelOn = (fill: string) => (isLightColor(fill) ? shade(fill, 0.6) : '#ffffff');

  const pool: ShapeColorPreset[] = [];
  // Lead with the theme's own look so "the current theme" is one click away.
  pool.push({
    id: 'theme',
    name: 'Theme',
    fill: baseFill,
    stroke: accent,
    text: baseText,
    borderStroke: 'medium',
    borderStyle: 'solid',
  });
  // Multi-colour themes: a tinted card per branch hue for genuine variety.
  if (theme.palette && theme.palette.length > 0) {
    theme.palette.forEach((entry, i) => {
      pool.push({
        id: `branch-${i}`,
        name: 'Branch',
        fill: tint(entry.stroke, 0.8),
        stroke: entry.stroke,
        text: shade(entry.stroke, 0.45),
        borderStroke: 'medium',
        borderStyle: 'solid',
      });
    });
  }
  pool.push(
    // ── The emphasis ramp, quietest → loudest ──
    {
      id: 'ghost',
      name: 'Ghost',
      fill: '#f8fafc',
      stroke: '#cbd5e1',
      text: '#64748b',
      borderStroke: 'thin',
      borderStyle: 'dashed',
    },
    {
      id: 'muted',
      name: 'Muted',
      fill: '#f1f5f9',
      stroke: '#94a3b8',
      text: '#475569',
      borderStroke: 'thin',
      borderStyle: 'solid',
    },
    {
      id: 'soft',
      name: 'Soft',
      fill: tint(accent, 0.85),
      stroke: tint(accent, 0.4),
      text: shade(accent, 0.5),
      borderStroke: 'thin',
      borderStyle: 'solid',
    },
    {
      id: 'tinted',
      name: 'Tinted',
      fill: tint(accent, 0.6),
      stroke: accent,
      text: shade(accent, 0.45),
      borderStroke: 'medium',
      borderStyle: 'solid',
    },
    {
      id: 'solid',
      name: 'Solid',
      fill: accent,
      stroke: shade(accent, 0.25),
      text: labelOn(accent),
      borderStroke: 'medium',
      borderStyle: 'solid',
    },
    {
      id: 'bold',
      name: 'Bold',
      fill: shade(accent, 0.3),
      stroke: shade(accent, 0.55),
      text: labelOn(shade(accent, 0.3)),
      borderStroke: 'thick',
      borderStyle: 'solid',
    },
    {
      id: 'inked',
      name: 'Inked',
      fill: '#0f172a',
      stroke: '#334155',
      text: '#f8fafc',
      borderStroke: 'medium',
      borderStyle: 'solid',
    },
    // ── Border treatments ──
    {
      id: 'outline',
      name: 'Outline',
      fill: '#ffffff',
      stroke: accent,
      text: shade(accent, 0.3),
      borderStroke: 'medium',
      borderStyle: 'dashed',
    },
    {
      id: 'dotted',
      name: 'Dotted',
      fill: tint(accent, 0.85),
      stroke: accent,
      text: shade(accent, 0.45),
      borderStroke: 'medium',
      borderStyle: 'dotted',
    },
    {
      id: 'frame',
      name: 'Frame',
      fill: '#ffffff',
      stroke: shade(accent, 0.4),
      text: shade(accent, 0.5),
      borderStroke: 'thick',
      borderStyle: 'solid',
    },
    // ── Semantic status colours (theme-independent, spec/48) ──
    {
      id: 'info',
      name: 'Info',
      fill: '#dbeafe',
      stroke: '#2563eb',
      text: '#1e3a8a',
      borderStroke: 'medium',
      borderStyle: 'solid',
    },
    {
      id: 'success',
      name: 'Success',
      fill: '#dcfce7',
      stroke: '#16a34a',
      text: '#14532d',
      borderStroke: 'medium',
      borderStyle: 'solid',
    },
    {
      id: 'warning',
      name: 'Warning',
      fill: '#fef3c7',
      stroke: '#d97706',
      text: '#78350f',
      borderStroke: 'medium',
      borderStyle: 'solid',
    },
    {
      id: 'danger',
      name: 'Danger',
      fill: '#fee2e2',
      stroke: '#dc2626',
      text: '#7f1d1d',
      borderStroke: 'medium',
      borderStyle: 'solid',
    },
  );

  const seen = new Set<string>();
  const out: ShapeColorPreset[] = [];
  for (const p of pool) {
    const key = `${p.fill}|${p.stroke}|${p.text}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.slice(0, 20);
}

// Resolve a stored `colorPreset` id (spec/48) to its colours UNDER A GIVEN
// THEME. Returns null when the theme has no such variant (e.g. a 'branch-2'
// preset after switching to a single-accent theme that has no branches) so the
// caller can leave the shape's current colours in place rather than blank them.
function shapeColorPresetById(
  theme: ThemeDefinition,
  id: string | undefined,
): ShapeColorPreset | null {
  if (!id) return null;
  return shapeColorPresets(theme).find((p) => p.id === id) ?? null;
}

// Re-derive a single shape's colours from its bound colour preset for `theme`.
// Used by the theme-change paths so a preset-styled shape tracks the new
// theme's matching variant instead of staying pinned to the old theme's
// colours. A non-shape, or a shape with no `colorPreset` (or a preset the
// theme lacks), is returned untouched.
export function rederiveColorPresetForTheme(el: Element, theme: ThemeDefinition): Element {
  if (el.type !== 'shape' || !el.colorPreset) return el;
  const preset = shapeColorPresetById(theme, el.colorPreset);
  if (!preset) return el;
  return {
    ...el,
    fillColor: preset.fill,
    strokeColor: preset.stroke,
    textColor: preset.text,
    strokeWidth: preset.borderStroke,
    strokeStyle: preset.borderStyle,
  };
}

// A categorical palette derived from the active theme, for charts (spec/53):
// multi-colour themes contribute each branch hue (genuinely distinct slices);
// single-accent themes contribute variants of the accent (lighter / darker
// tints) so the slices still read as "shades of the theme". Deduped
// (case-insensitive); always non-empty.
export function themeChartPalette(theme: ThemeDefinition): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (c: string | null | undefined) => {
    if (!c) return;
    const key = c.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  if (theme.palette && theme.palette.length > 0) {
    for (const entry of theme.palette) push(entry.stroke);
  }
  const accent = theme.elementStroke ?? DEFAULT_SHAPE_STROKE;
  // Accent variants — appended so single-accent themes get a spread and
  // palette themes pad out if they have few branches.
  push(accent);
  push(tint(accent, 0.4));
  push(shade(accent, 0.3));
  push(tint(accent, 0.7));
  push(shade(accent, 0.55));
  push(tint(accent, 0.2));
  if (theme.elementText) push(theme.elementText);
  return out;
}
