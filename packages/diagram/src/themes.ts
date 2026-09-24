// The shared theme ENGINE (spec/29, /42, /44, /48): theme data, types, and the
// pure element/backdrop transforms that take a resolved ThemeDefinition. Lives
// in the package so both the editor (apps/live) and the MCP worker (apps/mcp,
// spec/62) theme diagrams identically. Custom-theme (per-owner) resolution +
// deriveNewBoxedColours stay in apps/live/lib/themes.ts, which re-exports this.
import {
  deriveTextColorForBg,
  type BackgroundPattern,
  type Element,
  type ShapeKind,
} from './index';
import { rederiveColorPresetForTheme, rederiveTablePresetForTheme } from './theme-presets';
import { isAccentBarShape } from './web-components';
import { DEFAULT_SCHEME_DARK, DEFAULT_SCHEME_LIGHT, LEGACY_THEMES, THEMES } from './themes-data';
export { THEMES, LEGACY_THEMES, DEFAULT_SCHEME_LIGHT, DEFAULT_SCHEME_DARK };

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
export type ThemePaletteEntry = {
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
  // Catalogue metadata only: it marks the twelve that shipped first, and
  // nothing gates on it. All three theme surfaces (the palette accordion, the
  // Tab Appearance modal, the New-diagram picker) render the same
  // ThemeCategoryBrowser now (spec/09), so every theme is reachable by
  // category and there is no "Show more" left to sit behind.
  extra?: boolean;
};

// Picker grouping, mirroring the template catalogue's categories. Themes
// are bucketed by colour temperament so the picker reads as titled
// sections (Cool / Warm / Neutral / Multi-colour) instead of one flat
// grid. The mapping lives beside the catalogue so a new theme slots into
// a section with a one-line edit; the picker renders sections in
// THEME_CATEGORIES order and skips empties.
export type ThemeCategory = 'cool' | 'warm' | 'dark' | 'multicolour' | 'formal';

// Which chrome a viewer is looking at (spec/07). The Default colour scheme is
// the only one that reads it: every other scheme paints the same colours for
// everybody, because those colours are stored in the diagram.
export type Appearance = 'light' | 'dark';

// The id of the Default colour scheme. Stays 'brand' — it is the value saved
// diagrams carry, not a label.
export const DEFAULT_SCHEME_ID = 'brand';

/** The Default scheme as the given appearance paints it. */
export function defaultScheme(appearance: Appearance = 'light'): ThemeDefinition {
  return appearance === 'dark' ? DEFAULT_SCHEME_DARK : DEFAULT_SCHEME_LIGHT;
}

/** The colours a scheme paints the canvas with (its backdrop, minus the layout). */
export function schemeBackdrop(scheme: ThemeDefinition): {
  backgroundColor: string;
  patternColor: string;
} {
  return { backgroundColor: scheme.backgroundColor, patternColor: scheme.patternColor };
}

// Is this canvas still one the DEFAULT scheme painted — either half of it —
// rather than one somebody chose? Both halves count, because a tab saved by a
// viewer in dark chrome carries the dark half and is no less untouched for it.
// Both colours must match: a hand-picked pattern colour on an otherwise default
// canvas is still a choice, and a choice outranks the viewer's chrome.
export function isDefaultSchemeBackdrop(backdrop: {
  backgroundColor: string;
  patternColor: string;
}): boolean {
  return [DEFAULT_SCHEME_LIGHT, DEFAULT_SCHEME_DARK].some(
    (half) =>
      half.backgroundColor === backdrop.backgroundColor &&
      half.patternColor === backdrop.patternColor,
  );
}

// The backdrops a scheme could have painted. One for every scheme except
// Default, which has a light and a dark half — and the preserve-customs rules
// have to accept BOTH as "still on the scheme", or a tab saved in one
// appearance looks hand-coloured to a viewer in the other and freezes.
function backdropVariants(scheme: ThemeDefinition): ThemeDefinition[] {
  return scheme.id === DEFAULT_SCHEME_ID ? [DEFAULT_SCHEME_LIGHT, DEFAULT_SCHEME_DARK] : [scheme];
}

// Resolve an id to a BUILT-IN ThemeDefinition, falling back to Default. Looks
// through the offered catalogue and then the legacy schemes (ids that are no
// longer listed but still resolve, so old diagrams keep their look).
//
// `appearance` only ever changes the answer for Default, which has a light and
// a dark half; it defaults to light so pure callers with no viewer to ask
// (exports, the MCP worker, tests) land somewhere predictable. Custom
// (per-owner) themes are NOT resolved here — that needs the live app's
// registry; apps/live/lib/themes.ts wraps this as `getTheme`, which also
// supplies the current viewer's appearance.
export function getBuiltInTheme(
  id: string | undefined,
  appearance: Appearance = 'light',
): ThemeDefinition {
  if (id === undefined || id === DEFAULT_SCHEME_ID) return defaultScheme(appearance);
  return (
    THEMES.find((t) => t.id === id) ??
    LEGACY_THEMES.find((t) => t.id === id) ??
    defaultScheme(appearance)
  );
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
  // A video keeps its own look across themes, like image and sticky: the
  // poster frame is the content, and tinting the surround would only fight it.
  video: [],
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
  // An accent-bar web component (spec/147) paints its bar in the stroke
  // (unless a fill is picked) under white text, so only the stroke follows
  // the theme: the theme's element fill and ink are the pale-card pair, and
  // writing them into a bar would put pale text on a pale bar.
  if (el.type === 'shape' && isAccentBarShape(el.shape)) {
    return [{ element: 'strokeColor', theme: 'elementStroke' }];
  }
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
  // "Still on the previous scheme" means unset, or equal to what that scheme
  // paints — in any of its appearances (see backdropVariants).
  const wasOnScheme = <K extends 'backgroundColor' | 'backgroundPattern' | 'patternColor'>(
    field: K,
  ): boolean =>
    current[field] === undefined ||
    backdropVariants(prev).some((half) => current[field] === half[field]);
  // Pattern opacity follows the same preserve-customs rule, treating an
  // unset theme opacity as fully opaque (1).
  const prevOpacity = prev.backgroundOpacity ?? 1;
  const nextOpacity = next.backgroundOpacity ?? 1;
  const currentOpacity = current.backgroundOpacity ?? 1;
  return {
    backgroundColor: wasOnScheme('backgroundColor')
      ? next.backgroundColor
      : current.backgroundColor!,
    backgroundPattern: wasOnScheme('backgroundPattern')
      ? next.backgroundPattern
      : current.backgroundPattern!,
    patternColor: wasOnScheme('patternColor') ? next.patternColor : current.patternColor!,
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
  // A preset-bound shape KEEPS its binding (spec/48): the user chose "Bold",
  // so reset means "this theme's Bold" — re-derive the preset's colours +
  // border under the given theme (view) rather than blanking to the plain
  // look. Only a binding the theme can't express (e.g. a 'branch-3' under a
  // single-accent theme) falls through to the plain reset below and drops.
  if (el.type === 'shape' && el.colorPreset) {
    const rederived = rederiveColorPresetForTheme(el, theme);
    if (rederived !== el) return rederived;
  }
  // Same for a table's look: "reset" on a Banded table means this theme's
  // Banded, not a stripped grid.
  if (el.type === 'table' && el.tablePreset) {
    const rederived = rederiveTablePresetForTheme(el, theme);
    if (rederived !== el) return rederived;
  }
  const fields = themeColourFields(el);
  if (fields.length === 0) return el;
  const patch: Record<string, string | undefined> = {};
  for (const { element, theme: themeKey } of fields) {
    patch[element] = theme[themeKey] ?? undefined;
  }
  // A binding the theme has no variant for is dropped with the plain reset:
  // the shape is forced back to the theme look, so the preset no longer holds.
  if (el.type === 'shape' && el.colorPreset) {
    return { ...el, ...patch, colorPreset: undefined } as Element;
  }
  if (el.type === 'table' && el.tablePreset) {
    return { ...el, ...patch, tablePreset: undefined } as Element;
  }
  return { ...el, ...patch } as Element;
}
