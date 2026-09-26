import type { BorderStroke, BorderStyle } from './border-style';
import { isLightColor, shade, tint } from './colors';
import type { Element } from './index';
import type { ThemeDefinition } from './themes';

// Design-system defaults used when a theme defers its element colours
// (null = "use the built-in shape colours", e.g. the Default colour scheme). They
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

  // Neutral ramp — always useful (white → light grey → slate → ink). Four,
  // not five: with a single-accent theme's six swatches that is ten, and
  // the pipette + custom "+" make twelve, two full rows of six in the
  // menu. A fifth neutral pushed the "+" onto a row of its own.
  push('#ffffff');
  push('#e2e8f0');
  push('#94a3b8');
  push('#0f172a');
  return out.slice(0, 20);
}

// A one-click shape style preset (docs/specs/010-palette/style-presets.md): a complete look applied together —
// fill / stroke / text colour AND a matching border treatment (weight +
// pattern). Deliberately NOT the border radius: radius is a shape-silhouette
// choice the user makes separately, and presets clobbering it read as the
// preset "breaking" the shape. Derived from the active theme so the offered
// presets always match it, the same way themePresetColors derives the
// colour-picker swatches.
export type ShapeColorPreset = {
  // Stable identity for the preset, independent of the theme it's rendered
  // for (docs/specs/010-palette/style-presets.md). Stored on a shape's `colorPreset` so a theme change can
  // re-derive the same variant for the new theme. The variants are fixed
  // tokens: the theme tier 'theme' | 'soft' | 'tinted' | 'solid' | 'bold'
  // (multi-colour themes' per-branch cards are 'branch-<i>'), the neutral
  // tier 'ghost' | 'paper' | 'muted' | 'slate' | 'inked', the border tier
  // 'hairline' | 'outline' | 'dotted' | 'dash-dot' | 'frame', and the status
  // tier 'info' | 'success' | 'warning' | 'danger' | 'highlight'. (A legacy
  // 'pill' binding from before radius left the presets simply stops
  // re-deriving.)
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

// The style presets for a shape — each a complete look (colour + matching
// border weight/pattern), one flat grid ordered in four tiers, each tier
// quiet → loud so the grid reads as a run of ramps (the tiers are an
// ordering only: headings over them cost more menu height than they earned):
//   1. Theme — the accent at rising intensity: Theme (the theme's own look,
//      plus a card per branch hue on multi-colour themes), Soft, Tinted,
//      Solid, Bold.
//   2. Neutral — theme-independent greys: Ghost, Paper, Muted, Slate, Inked.
//   3. Border — line treatments: Hairline, Outline, Dotted, Dash-Dot, Frame.
//   4. Status — semantic colours, the same under every theme: Info, Success,
//      Warning, Danger, Highlight.
// Filled variants pick a contrasting label colour (white on dark, a deep
// shade on light) so text stays readable. Deduped on the exact
// fill+stroke+text triple; not capped, so no group is ever cut short (a
// six-branch theme shows 26 tiles).
export function shapeColorPresets(theme: ThemeDefinition): ShapeColorPreset[] {
  const accent = theme.elementStroke ?? DEFAULT_SHAPE_STROKE;
  const baseFill = theme.elementFill ?? DEFAULT_SHAPE_FILL;
  const baseText = theme.elementText ?? DEFAULT_SHAPE_TEXT;
  // A readable label colour for a filled tile: white on a dark fill, a deep
  // shade of the fill on a light one.
  const labelOn = (fill: string) => (isLightColor(fill) ? shade(fill, 0.6) : '#ffffff');

  const pool: ShapeColorPreset[] = [];
  // ── Theme: the accent, quiet → loud ──
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
    // ── Neutral: greys, quiet → loud ──
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
      // A plain white card with a hairline grey edge: the quietest solid look.
      id: 'paper',
      name: 'Paper',
      fill: '#ffffff',
      stroke: '#cbd5e1',
      text: '#334155',
      borderStroke: 'thin',
      borderStyle: 'solid',
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
      // A filled mid-grey: emphasis without the accent, between Muted and
      // Inked.
      id: 'slate',
      name: 'Slate',
      fill: '#64748b',
      stroke: '#475569',
      text: '#ffffff',
      borderStroke: 'medium',
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
    // ── Border: line treatments ──
    {
      // The accent as a thin line and the label in the same colour: a line
      // drawing. Its text is the accent itself (Outline's is a shade of it), so
      // the two never dedupe into one.
      id: 'hairline',
      name: 'Hairline',
      fill: '#ffffff',
      stroke: accent,
      text: accent,
      borderStroke: 'thin',
      borderStyle: 'solid',
    },
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
      id: 'dash-dot',
      name: 'Dash-Dot',
      fill: tint(accent, 0.92),
      stroke: accent,
      text: shade(accent, 0.4),
      borderStroke: 'medium',
      borderStyle: 'dash-dot',
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
    // ── Status: semantic colours (theme-independent, docs/specs/010-palette/style-presets.md) ──
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
    {
      // Violet: "look here", for a callout that is none of the four
      // states above.
      id: 'highlight',
      name: 'Highlight',
      fill: '#ede9fe',
      stroke: '#7c3aed',
      text: '#4c1d95',
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
  return out;
}

// Resolve a stored `colorPreset` id (docs/specs/010-palette/style-presets.md) to its colours UNDER A GIVEN
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

// A categorical palette derived from the active theme, for charts (docs/specs/009-elements/pie-chart.md):
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

// ── Sticky-note presets (docs/specs/010-palette/style-presets.md) ───────────────────────────────────────
//
// A pad of note colours, and NOT theme-derived: a sticky is exempt from theme
// recolouring (docs/specs/021-event-storming/event-storming.md) precisely because the colour of a note is the user's
// own shorthand, not the board's palette. It had no presets at all, so
// recolouring one meant opening Colours and picking a fill and then a matching
// text colour by hand, which is two decisions for what is really one.
//
// Each carries a readable ink for its paper, and NO border: a sticky's edge
// against its peel shadow is its border, so `stroke` is transparent and the
// weight is 'none'. Applying one clears any hand-set border with it.
export const STICKY_PRESETS: readonly ShapeColorPreset[] = (
  [
    // Warm half of the pad, the colours a physical block of notes comes in.
    ['classic', 'Classic', '#fde68a', '#451a03'],
    ['lemon', 'Lemon', '#fef08a', '#422006'],
    ['peach', 'Peach', '#fed7aa', '#431407'],
    ['rose', 'Rose', '#fecdd3', '#4c0519'],
    // Cool half.
    ['lilac', 'Lilac', '#e9d5ff', '#3b0764'],
    ['sky', 'Sky', '#bae6fd', '#082f49'],
    ['mint', 'Mint', '#bbf7d0', '#052e16'],
    ['teal', 'Teal', '#99f6e4', '#042f2e'],
    // Neutrals, for the notes that are structure rather than content.
    ['slate', 'Slate', '#e2e8f0', '#0f172a'],
    ['paper', 'Paper', '#ffffff', '#0f172a'],
    ['charcoal', 'Charcoal', '#334155', '#f1f5f9'],
    ['ink', 'Ink', '#0f172a', '#e2e8f0'],
  ] as const
).map(([id, name, fill, text]) => ({
  id: `sticky-${id}`,
  name,
  fill,
  stroke: 'transparent',
  text,
  borderStroke: 'none' as const,
  borderStyle: 'solid' as const,
}));

// ── Table presets (docs/specs/010-palette/style-presets.md) ─────────────────────────────────────────────

/** One complete table look: the four surfaces a table paints, plus the
 *  banding, which is a look rather than structure. */
export type TablePreset = {
  id: string;
  name: string;
  /** Cell background, grid lines, cell text. */
  fill: string;
  stroke: string;
  text: string;
  /** The header band. Its fill is the shared `headerFill`, since a table's
   *  header row and a lane's title gutter are one idea (docs/specs/009-elements/lane.md). */
  headerFill: string;
  headerText: string;
  /** Alternating body-row tint. */
  zebra: boolean;
};

/**
 * Table looks, theme-derived like the shape presets.
 *
 * A table has FOUR colours that only read well in certain combinations (cells,
 * grid, header band, header text), so picking them one swatch at a time meant
 * four decisions and a fair chance of a header you cannot read. The tiers
 * mirror the shape grid: the theme's own accent first, then neutrals that are
 * the same under every theme.
 *
 * `headerRow` / `headerColumn` are deliberately untouched: which cells ARE
 * headers is data, not a look, and a preset flipping it would silently
 * re-read the first row of somebody's table as a heading.
 */
export function tableColorPresets(theme: ThemeDefinition): TablePreset[] {
  const accent = theme.elementStroke ?? DEFAULT_SHAPE_STROKE;
  const baseFill = theme.elementFill ?? DEFAULT_SHAPE_FILL;
  const baseText = theme.elementText ?? DEFAULT_SHAPE_TEXT;
  const labelOn = (fill: string) => (isLightColor(fill) ? shade(fill, 0.6) : '#ffffff');
  return [
    // ── Theme: the accent, quiet to loud ──
    {
      id: 'table-theme',
      name: 'Theme',
      fill: baseFill,
      stroke: accent,
      text: baseText,
      headerFill: tint(accent, 0.7),
      headerText: shade(accent, 0.5),
      zebra: false,
    },
    {
      id: 'table-banded',
      name: 'Banded',
      fill: baseFill,
      stroke: tint(accent, 0.4),
      text: baseText,
      headerFill: tint(accent, 0.7),
      headerText: shade(accent, 0.5),
      zebra: true,
    },
    {
      id: 'table-bold',
      name: 'Bold Head',
      fill: baseFill,
      stroke: tint(accent, 0.4),
      text: baseText,
      headerFill: accent,
      headerText: labelOn(accent),
      zebra: false,
    },
    {
      // Grid lines and nothing else: the table reads as structure over
      // whatever it sits on, which is what you want over a frame or a photo.
      id: 'table-minimal',
      name: 'Minimal',
      fill: 'transparent',
      stroke: tint(accent, 0.55),
      text: baseText,
      headerFill: 'transparent',
      headerText: shade(accent, 0.45),
      zebra: false,
    },
    // ── Neutral: the same under every theme ──
    {
      id: 'table-plain',
      name: 'Plain',
      fill: '#ffffff',
      stroke: '#cbd5e1',
      text: '#0f172a',
      headerFill: '#f1f5f9',
      headerText: '#0f172a',
      zebra: false,
    },
    {
      id: 'table-paper',
      name: 'Paper',
      fill: '#f8fafc',
      stroke: '#e2e8f0',
      text: '#334155',
      headerFill: '#e2e8f0',
      headerText: '#0f172a',
      zebra: true,
    },
    {
      id: 'table-slate',
      name: 'Slate',
      fill: '#f1f5f9',
      stroke: '#94a3b8',
      text: '#0f172a',
      headerFill: '#475569',
      headerText: '#f8fafc',
      zebra: false,
    },
    {
      id: 'table-inked',
      name: 'Inked',
      fill: '#1e293b',
      stroke: '#475569',
      text: '#e2e8f0',
      headerFill: '#0f172a',
      headerText: '#f8fafc',
      zebra: false,
    },
  ];
}

/**
 * Re-derive a table's colours from its bound look for `theme`, the way
 * `rederiveColorPresetForTheme` does for a shape.
 *
 * A table preset writes resolved colours (four surfaces plus the banding), so
 * without the stored id a theme change sees four hand-picked colours and
 * preserves them as customs: the table kept the OLD theme's header band while
 * every shape around it moved. The id is what tells the two apart.
 *
 * A table with no binding, or one whose look the theme cannot express, is
 * returned untouched so the caller can fall back to the ordinary preserve-
 * customs walk.
 */
export function rederiveTablePresetForTheme(el: Element, theme: ThemeDefinition): Element {
  if (el.type !== 'table' || !el.tablePreset) return el;
  const preset = tableColorPresets(theme).find((p) => p.id === el.tablePreset);
  if (!preset) return el;
  return {
    ...el,
    fillColor: preset.fill,
    strokeColor: preset.stroke,
    textColor: preset.text,
    headerFill: preset.headerFill,
    headerTextColor: preset.headerText,
    zebra: preset.zebra,
  };
}
