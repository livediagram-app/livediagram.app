// The shared theme ENGINE (spec/29, /42, /44, /48): theme data, types, and the
// pure element/backdrop transforms that take a resolved ThemeDefinition. Lives
// in the package so both the editor (apps/live) and the MCP worker (apps/mcp,
// spec/62) theme diagrams identically. Custom-theme (per-owner) resolution +
// deriveNewBoxedColours stay in apps/live/lib/themes.ts, which re-exports this.
import {
  deriveTextColorForBg,
  isLightColor,
  shade,
  tint,
  type BackgroundPattern,
  type Element,
  type ShapeKind,
} from './index';
import { assignBranches, branchOfArrow, ROOT_BRANCH } from './hierarchy';
import { THEMES } from './themes-data';
export { THEMES };

// A preset theme bundles a canvas backdrop (background colour + pattern +
// pattern colour) with the default colours used for newly added boxed
// elements. Picking a theme (from the canvas context menu or the Tab
// Appearance modal) updates both halves at once; existing elements are
// unaffected. Themes
// are referenced by string id (stored on Tab.theme) so they survive
// renames + can be extended without breaking saved diagrams.

export type ThemeId =
  | 'brand'
  // 'slate' is a legacy id: the theme it points at is now Pink (the old
  // grey Slate was too close to Steel / Charcoal / Mono). Kept as the id
  // so diagrams saved against it keep resolving.
  | 'slate'
  | 'forest'
  | 'sunset'
  | 'lavender'
  | 'mono'
  | 'ocean'
  | 'sky'
  | 'midnight'
  | 'cream'
  | 'rose'
  | 'sand'
  | 'olive'
  | 'indigo'
  | 'pine'
  | 'steel'
  | 'mocha'
  | 'charcoal'
  // Further dark-backdrop themes (the picker's Dark category).
  | 'plum'
  | 'abyss'
  | 'espresso'
  // Multi-colour ("rainbow") themes — see spec/29. Each carries a
  // `palette` so branches of the hierarchy get distinct hues.
  | 'rainbow'
  | 'pastel'
  | 'tropical'
  | 'autumn'
  | 'jewel'
  // Formal: standard notations. UML paints each shape kind its
  // conventional colour (spec/42).
  | 'uml';

// One branch colour for a multi-colour theme: the fill / stroke / text
// triple a single limb of the hierarchy is painted with. Unlike the
// single-colour `elementFill` etc. fields (which are nullable to let the
// brand theme defer to type-defaults), a palette entry is always a
// concrete colour — a palette theme always paints.
type ThemePaletteEntry = {
  fill: string;
  stroke: string;
  text: string;
};

// A per-shape-kind colour override (see `ThemeDefinition.shapeColors`).
// Each field is optional: an unset one falls through to the theme's
// element-level colour, so a theme can recolour just the fill of one
// kind without restating its stroke / text.
type ShapeColourOverride = { fill?: string; stroke?: string; text?: string };

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  // Backdrop.
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  patternColor: string;
  // Pattern opacity 0..1. Absent = fully opaque; carried so a (custom)
  // theme can ship a faded pattern (spec/44). Applied to the tab on theme
  // switch via switchThemeBackdrop.
  backgroundOpacity?: number;
  // Defaults for newly added boxed elements. `null` means "fall through
  // to the type-default" — used by the brand theme so it stays identical
  // to the un-themed default.
  elementFill: string | null;
  elementStroke: string | null;
  elementText: string | null;
  // Multi-colour themes (spec/29) carry a palette: an ordered list of
  // branch colours that the hierarchy cycles through
  // (palette[branchIndex % palette.length]), plus a `rootColor` for the
  // trunk (root nodes + not-yet-connected elements). Absent on
  // single-colour themes, which keep painting via elementFill/Stroke/Text.
  palette?: ThemePaletteEntry[];
  rootColor?: ThemePaletteEntry;
  // Per-shape-kind colour overrides (spec/42 "Formal themes / UML"). When
  // a theme assigns a kind its own colours — e.g. UML paints a decision
  // diamond, a datastore cylinder and a process box differently — these
  // win over the single elementFill / -Stroke / -Text for that kind.
  // Kinds left unset fall through to the element-level fields. Only shape
  // elements carry a `shape` kind, so this never touches text / arrows /
  // tables. Resolved through `elementThemeView` (like the palette branch
  // colours), so every theme transform stays shape-aware with no second
  // code path. A theme can combine this with a palette, but in practice
  // per-shape themes (UML) and per-branch themes (rainbow) are distinct.
  shapeColors?: Partial<Record<ShapeKind, ShapeColourOverride>>;
  // True for themes that sit behind the picker's "Show more" toggle —
  // both in the welcome / template picker AND in the Current Tab theme
  // grid. The default twelve render in the first batch; extras unlock
  // on click so the grids stay compact for first-time users.
  extra?: boolean;
};

// Picker grouping, mirroring the template catalogue's categories. Themes
// are bucketed by colour temperament so the picker reads as titled
// sections (Cool / Warm / Neutral / Multi-colour) instead of one flat
// grid. The mapping lives beside the catalogue so a new theme slots into
// a section with a one-line edit; the picker renders sections in
// THEME_CATEGORIES order and skips empties.
export type ThemeCategory = 'cool' | 'warm' | 'dark' | 'multicolour' | 'formal';

// Resolve an id to a BUILT-IN ThemeDefinition (the catalogue), falling back to
// the default. Custom (per-owner) themes are NOT resolved here — that needs the
// live app's registry; apps/live/lib/themes.ts wraps this with custom-theme
// resolution as `getTheme`. The MCP worker uses this directly (built-ins only).
export function getBuiltInTheme(id: string | undefined): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

// Which element-colour fields each element type writes from a theme.
// The three theme transforms below (recolour / switch / reset) all
// iterate this one table, so adding a themable element kind is a single
// entry here rather than three parallel `if (el.type === ...)` chains
// that can silently drift apart — which is exactly how freehand sketches
// ended up ignored by all three before this table landed. Sticky notes
// and images map to nothing: stickies keep their iconic amber across
// every theme (same rule `addBoxed` applies to ad-hoc sticky creation),
// and an image renders its bytes so its colour fields are inert (see
// ImageElement in @livediagram/diagram).
type ThemeColourField = {
  element: 'fillColor' | 'strokeColor' | 'textColor';
  theme: 'elementFill' | 'elementStroke' | 'elementText';
};
const THEME_COLOUR_FIELDS: Record<Element['type'], ThemeColourField[]> = {
  shape: [
    { element: 'fillColor', theme: 'elementFill' },
    { element: 'strokeColor', theme: 'elementStroke' },
    { element: 'textColor', theme: 'elementText' },
  ],
  // Sketches carry the same fill + stroke a shape does (open paths
  // render stroke-only, so a written fill is inert until the path is
  // closed); mirrors the theme-aware colours commitFreehand applies on
  // creation so a sketch reads as part of the diagram either way.
  freehand: [
    { element: 'fillColor', theme: 'elementFill' },
    { element: 'strokeColor', theme: 'elementStroke' },
  ],
  text: [{ element: 'textColor', theme: 'elementText' }],
  // Tables theme their grid lines + cell text, but keep cells
  // transparent (no fill mapping) so the grid reads as a grid.
  table: [
    { element: 'strokeColor', theme: 'elementStroke' },
    { element: 'textColor', theme: 'elementText' },
  ],
  arrow: [{ element: 'strokeColor', theme: 'elementStroke' }],
  sticky: [],
  image: [],
  // Annotation markers theme their circle fill + ring/glyph stroke like a
  // shape; no themed text (the note is plain). See spec/38.
  annotation: [
    { element: 'fillColor', theme: 'elementFill' },
    { element: 'strokeColor', theme: 'elementStroke' },
  ],
  // Link cards keep their neutral bookmark-card look regardless of theme
  // (like sticky / image); the user can still recolour per-card. See spec/40.
  'link-card': [],
};

// The colour fields a given element actually exposes to theming. Starts
// from the per-type table above, then drops `fillColor` when the element
// opts out via `themeLockFill` — its fill is intrinsic and must survive
// theme changes (e.g. the Gantt chart's per-milestone bars, which would
// otherwise all collapse to the theme's single element-fill and lose the
// distinction that makes the timeline readable). All three transforms
// below funnel through this so the opt-out can't apply to one and silently
// drift from the others. Stroke + text stay themed.
function themeColourFields(el: Element): ThemeColourField[] {
  const fields = THEME_COLOUR_FIELDS[el.type];
  if ((el as { themeLockFill?: boolean }).themeLockFill) {
    return fields.filter((f) => f.element !== 'fillColor');
  }
  return fields;
}

// Apply a theme's element-colour overrides to a single Element,
// returning a new element with the theme's fill / stroke / text fields
// written when the theme defines them, and untouched otherwise. Used by
// both the /live/new template path (templates.ts) and the in-editor
// "Browse templates" picker (editor-page.tsx) so the two paths can't
// drift, e.g. by accidentally omitting arrows or sketches.
export function recolourElementForTheme(el: Element, theme: ThemeDefinition): Element {
  const fields = themeColourFields(el);
  if (fields.length === 0) return el;
  const patch: Record<string, string> = {};
  for (const { element, theme: themeKey } of fields) {
    const value = theme[themeKey];
    if (value) patch[element] = value;
  }
  return { ...el, ...patch } as Element;
}

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

// A one-click shape colour preset (spec/48): fill / border / text applied
// together. Derived from the active theme so the offered presets always match
// it, the same way themePresetColors derives the colour-picker swatches.
export type ShapeColorPreset = {
  // Stable identity for the preset, independent of the theme it's rendered
  // for (spec/48). Stored on a shape's `colorPreset` so a theme change can
  // re-derive the same variant for the new theme. The emphasis variants are
  // fixed tokens ('theme', 'soft', 'tinted', 'solid', 'bold', 'outline',
  // 'muted', 'inked'); multi-colour themes' per-branch cards are 'branch-<i>'.
  id: string;
  name: string;
  fill: string;
  stroke: string;
  text: string;
};

// Eight on-theme colour variations for a shape — spanning the theme's default
// look through soft / tinted / solid / bold / outline / muted / inked emphasis
// (plus a card per branch hue on multi-colour themes). Filled variants pick a
// contrasting label colour (white on dark, a deep shade on light) so text
// stays readable. Deduped on the exact fill+stroke+text triple, capped at 8.
export function shapeColorPresets(theme: ThemeDefinition): ShapeColorPreset[] {
  const accent = theme.elementStroke ?? DEFAULT_SHAPE_STROKE;
  const baseFill = theme.elementFill ?? DEFAULT_SHAPE_FILL;
  const baseText = theme.elementText ?? DEFAULT_SHAPE_TEXT;
  // A readable label colour for a filled tile: white on a dark fill, a deep
  // shade of the fill on a light one.
  const labelOn = (fill: string) => (isLightColor(fill) ? shade(fill, 0.6) : '#ffffff');

  const pool: ShapeColorPreset[] = [];
  // Lead with the theme's own look so "the current theme" is one click away.
  pool.push({ id: 'theme', name: 'Theme', fill: baseFill, stroke: accent, text: baseText });
  // Multi-colour themes: a tinted card per branch hue for genuine variety.
  if (theme.palette && theme.palette.length > 0) {
    theme.palette.forEach((entry, i) => {
      pool.push({
        id: `branch-${i}`,
        name: 'Branch',
        fill: tint(entry.stroke, 0.8),
        stroke: entry.stroke,
        text: shade(entry.stroke, 0.45),
      });
    });
  }
  // Accent-derived emphasis variants — always appended so single-accent themes
  // get a full spread and palette themes pad to eight.
  pool.push(
    {
      id: 'soft',
      name: 'Soft',
      fill: tint(accent, 0.85),
      stroke: tint(accent, 0.4),
      text: shade(accent, 0.5),
    },
    {
      id: 'tinted',
      name: 'Tinted',
      fill: tint(accent, 0.6),
      stroke: accent,
      text: shade(accent, 0.45),
    },
    {
      id: 'solid',
      name: 'Solid',
      fill: accent,
      stroke: shade(accent, 0.25),
      text: labelOn(accent),
    },
    {
      id: 'bold',
      name: 'Bold',
      fill: shade(accent, 0.3),
      stroke: shade(accent, 0.55),
      text: labelOn(shade(accent, 0.3)),
    },
    { id: 'outline', name: 'Outline', fill: '#ffffff', stroke: accent, text: shade(accent, 0.3) },
    { id: 'muted', name: 'Muted', fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569' },
    { id: 'inked', name: 'Inked', fill: '#0f172a', stroke: '#334155', text: '#f8fafc' },
  );

  const seen = new Set<string>();
  const out: ShapeColorPreset[] = [];
  for (const p of pool) {
    const key = `${p.fill}|${p.stroke}|${p.text}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.slice(0, 8);
}

// Resolve a stored `colorPreset` id (spec/48) to its colours UNDER A GIVEN
// THEME. Returns null when the theme has no such variant (e.g. a 'branch-2'
// preset after switching to a single-accent theme that has no branches) so the
// caller can leave the shape's current colours in place rather than blank them.
export function shapeColorPresetById(
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
  return { ...el, fillColor: preset.fill, strokeColor: preset.stroke, textColor: preset.text };
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

// Soft theme switch: change the diagram's theme but preserve every
// per-element colour the user has CUSTOMISED. A field counts as
// "still on the old theme" (and is therefore safe to replace) when
// either:
//   - it's unset (undefined), or
//   - it equals the previous theme's value for that field.
// Otherwise it's a user override and we leave it alone. Used by the
// Theme accordion's preset row.
//
// The rule applies per-field, not per-element, so a shape whose
// fill was customised but whose stroke wasn't will get a new
// stroke while keeping its fill. Sticky notes + images stay
// untouched (empty field list in THEME_COLOUR_FIELDS).
export function switchThemeElement(
  el: Element,
  prev: ThemeDefinition,
  next: ThemeDefinition,
): Element {
  const fields = themeColourFields(el);
  if (fields.length === 0) return el;
  // Read the colour fields off the element generically. The cast is
  // safe: we only ever index keys from THEME_COLOUR_FIELDS, all of
  // which are `string | undefined` colour fields on every type that
  // has a non-empty field list.
  const current = el as unknown as Record<string, string | undefined>;
  const patch: Record<string, string | undefined> = {};
  for (const { element, theme: themeKey } of fields) {
    // Tables derive their cell fill + text from the BACKDROP (cells track
    // the canvas colour so the table blends in, only grid lines + text
    // read), not from elementFill / elementText alone. Handle fill + text
    // below; the generic rule would compare a backdrop-derived text colour
    // against the old theme's `elementText` (null on light themes) and so
    // mistake it for a user override, stranding dark text on a dark theme.
    if (el.type === 'table' && element === 'textColor') continue;
    const value = current[element];
    patch[element] =
      value === undefined || value === prev[themeKey] ? (next[themeKey] ?? undefined) : value;
  }
  if (el.type === 'table') {
    // The "on-theme" table colours, matching deriveNewBoxedColours: cells
    // are the canvas background, text contrasts with it (an explicit
    // elementText wins when the theme sets one). Replace each only when the
    // current value is still the OLD theme's backdrop colour (or unset),
    // preserving a genuine per-table override.
    const prevText = prev.elementText ?? deriveTextColorForBg(prev.backgroundColor);
    const nextText = next.elementText ?? deriveTextColorForBg(next.backgroundColor);
    if (current.textColor === undefined || current.textColor === prevText) {
      patch.textColor = nextText;
    }
    if (current.fillColor === undefined || current.fillColor === prev.backgroundColor) {
      patch.fillColor = next.backgroundColor;
    }
  }
  return { ...el, ...patch } as Element;
}

// Backdrop counterpart to `switchThemeElement`. The canvas backdrop
// (background colour + pattern + pattern colour) follows the SAME
// preserve-customs rule as element colours: a field is replaced with
// the new theme's value only when it's unset or still matches the
// previous theme's value, and kept when the user has deliberately set
// it to something else. Without this, picking a theme would clobber a
// chosen canvas pattern — e.g. reset Graph back to the theme's Grid, or
// blank it entirely for Mono — which reads as "changing the theme loses
// the canvas grid".
export type TabBackdrop = {
  backgroundColor?: string;
  backgroundPattern?: BackgroundPattern;
  patternColor?: string;
  backgroundOpacity?: number;
};

export function switchThemeBackdrop(
  current: TabBackdrop,
  prev: ThemeDefinition,
  next: ThemeDefinition,
): Required<TabBackdrop> {
  // Pattern opacity follows the same preserve-customs rule, treating an
  // unset theme opacity as fully opaque (1).
  const prevOpacity = prev.backgroundOpacity ?? 1;
  const nextOpacity = next.backgroundOpacity ?? 1;
  const currentOpacity = current.backgroundOpacity ?? 1;
  return {
    backgroundColor:
      current.backgroundColor === undefined || current.backgroundColor === prev.backgroundColor
        ? next.backgroundColor
        : current.backgroundColor,
    backgroundPattern:
      current.backgroundPattern === undefined ||
      current.backgroundPattern === prev.backgroundPattern
        ? next.backgroundPattern
        : current.backgroundPattern,
    patternColor:
      current.patternColor === undefined || current.patternColor === prev.patternColor
        ? next.patternColor
        : current.patternColor,
    backgroundOpacity: currentOpacity === prevOpacity ? nextOpacity : currentOpacity,
  };
}

// Hard reset: force every themable colour on every shape / text /
// arrow / sketch back to the current theme's value, OVERWRITING any
// custom per-element colours the user set. Surfaces as "Reset elements
// to theme" under the Theme accordion. Sticky notes + images stay
// untouched (empty field list in THEME_COLOUR_FIELDS).
//
// Difference vs `recolourElementForTheme`: when the theme's value
// is null (e.g. the Brand theme has no element-fill override), the
// reset BLANKS the element's field (sets it to undefined) rather
// than leaving the existing custom value in place. Recolour-for-
// theme is "apply when present", reset is "make match the theme,
// blank when the theme blanks".
export function resetThemeElement(el: Element, theme: ThemeDefinition): Element {
  const fields = themeColourFields(el);
  if (fields.length === 0) return el;
  const patch: Record<string, string | undefined> = {};
  for (const { element, theme: themeKey } of fields) {
    patch[element] = theme[themeKey] ?? undefined;
  }
  // A hard reset drops any colour-preset binding (spec/48) too: the shape is
  // being forced back to the plain theme look, so the preset no longer holds.
  if (el.type === 'shape' && el.colorPreset) {
    return { ...el, ...patch, colorPreset: undefined } as Element;
  }
  return { ...el, ...patch } as Element;
}

// --- Multi-colour ("rainbow") themes (spec/29) -----------------------
//
// A palette theme paints each branch of the hierarchy a different hue
// instead of one colour for everything. Branch assignment needs the
// WHOLE element list (to read the pinned-arrow graph), so the three
// transforms above — which are per-element — can't express it directly.
//
// The trick: for a palette theme we resolve each element's branch
// colours and hand the existing per-element transform a SYNTHETIC theme
// whose elementFill / -Stroke / -Text are that element's branch colours.
// Every existing rule (sticky / image opt-out, themeLockFill, the table
// backdrop handling) then applies unchanged — there's no second code
// path to keep in sync. Single-colour themes skip all of this and fall
// straight through to the per-element helpers.

// The branch colours a given element should be painted with under a
// palette theme: the palette entry for its branch, or the trunk colour
// (rootColor) for root + not-yet-connected elements.
function branchEntryFor(
  theme: ThemeDefinition,
  el: Element,
  branches: Map<string, number>,
): ThemePaletteEntry {
  const palette = theme.palette!;
  const root = theme.rootColor ?? {
    fill: theme.elementFill ?? '#f1f5f9',
    stroke: theme.elementStroke ?? '#475569',
    text: theme.elementText ?? '#0f172a',
  };
  const index =
    el.type === 'arrow' ? branchOfArrow(el, branches) : (branches.get(el.id) ?? ROOT_BRANCH);
  if (index === ROOT_BRANCH) return root;
  // Guard against an empty palette + negative modulo.
  const i = ((index % palette.length) + palette.length) % palette.length;
  return palette[i] ?? root;
}

// A per-element theme view: the same theme, but with its single-colour
// element fields swapped for this element's branch colours (palette
// themes) and/or its shape kind's colours (per-shape themes like UML).
// Identity for a plain single-colour theme. Folding both rewrites here
// means every transform (recolour / switch / reset) is branch- AND
// shape-aware through one code path.
function elementThemeView(
  theme: ThemeDefinition,
  el: Element,
  branches: Map<string, number> | null,
): ThemeDefinition {
  let view = theme;
  if (theme.palette && branches) {
    const entry = branchEntryFor(theme, el, branches);
    view = {
      ...view,
      elementFill: entry.fill,
      elementStroke: entry.stroke,
      elementText: entry.text,
    };
  }
  // Per-shape overrides win over the branch / base colours: a UML
  // diamond stays amber even if it sits on a coloured branch. Unset
  // fields fall through to whatever the view resolved above.
  if (theme.shapeColors && el.type === 'shape') {
    const c = theme.shapeColors[el.shape];
    if (c) {
      view = {
        ...view,
        elementFill: c.fill ?? view.elementFill,
        elementStroke: c.stroke ?? view.elementStroke,
        elementText: c.text ?? view.elementText,
      };
    }
  }
  return view;
}

// Graph-aware counterpart to `recolourElementForTheme`: paints a fresh
// scaffold (template / Markdown import) with a theme, rainbowing the
// branches when the theme has a palette. Used by every "apply a theme to
// these elements" path so single- and multi-colour themes share one
// entry point.
export function recolourElementsForTheme(elements: Element[], theme: ThemeDefinition): Element[] {
  const branches = theme.palette ? assignBranches(elements) : null;
  return elements.map((el) =>
    // A shape bound to a colour preset (spec/48) takes the preset's variant for
    // this theme, not the plain branch / base colours — so a template's Bold
    // key element stays Bold in whatever theme it's built with.
    el.type === 'shape' && el.colorPreset
      ? rederiveColorPresetForTheme(el, theme)
      : recolourElementForTheme(el, elementThemeView(theme, el, branches)),
  );
}

// Graph-aware counterpart to `switchThemeElement`: the in-editor
// "pick a theme" path. Computes the branch map once per side (only when
// that side is a palette theme) so the preserve-customs comparison sees
// the right per-element colours.
export function switchThemeElements(
  elements: Element[],
  prev: ThemeDefinition,
  next: ThemeDefinition,
): Element[] {
  const prevBranches = prev.palette ? assignBranches(elements) : null;
  const nextBranches = next.palette ? assignBranches(elements) : null;
  return elements.map((el) =>
    // Preset-bound shapes (spec/48) re-derive their preset for the new theme
    // instead of being preserved as a manual override — picking a new theme
    // moves a Bold-preset shape to that theme's Bold look rather than stranding
    // it on the previous theme's colours.
    el.type === 'shape' && el.colorPreset
      ? rederiveColorPresetForTheme(el, next)
      : switchThemeElement(
          el,
          elementThemeView(prev, el, prevBranches),
          elementThemeView(next, el, nextBranches),
        ),
  );
}

// Graph-aware counterpart to `resetThemeElement`: the "Reset elements to
// theme" button. Force-repaints every branch from the palette.
export function resetThemeElementsToTheme(elements: Element[], theme: ThemeDefinition): Element[] {
  const branches = theme.palette ? assignBranches(elements) : null;
  return elements.map((el) => resetThemeElement(el, elementThemeView(theme, el, branches)));
}

// Force every ARROW back to the theme's stroke, overwriting any
// per-arrow custom colour, while leaving non-arrow elements untouched.
// Picking a theme runs the preserve-customs `switchThemeElements` for
// shapes/text/etc., then this on top so connectors ALWAYS track the
// theme rather than drifting once a user has hand-coloured one (a tidy
// recolour reads as broken if the lines stay the old hue). Palette-aware:
// each arrow snaps to its branch's stroke via the same per-element view
// every other transform uses, so there's no parallel colour path.
export function resetArrowsToTheme(elements: Element[], theme: ThemeDefinition): Element[] {
  const branches = theme.palette ? assignBranches(elements) : null;
  return elements.map((el) =>
    el.type === 'arrow' ? resetThemeElement(el, elementThemeView(theme, el, branches)) : el,
  );
}
