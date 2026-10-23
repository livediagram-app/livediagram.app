// The shared theme ENGINE (catalogue, types, recolour / switch / reset / preset
// transforms) now lives in @livedocuments/document so the MCP worker (docs/specs/015-api/mcp-server.md)
// themes tabs identically to the editor. This file re-exports it and adds
// the LIVE-ONLY layer: custom-theme (per-owner, docs/specs/011-theme/custom-themes.md) resolution and the
// new-element colour derivation that depends on it. The ~120 `@/lib/themes`
// consumers are unchanged — every symbol they imported is still exported here.
import {
  getBuiltInTheme,
  isDefaultSchemeBackdrop,
  THEMES,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_SCHEME_ID,
  deriveShapeColours,
  deriveTextColorForBg,
  DEFAULT_SCHEME_LIGHT,
  themeColourMap,
  themeHalf,
  viewBackdropInTheme,
  type Appearance,
  type BackgroundPattern,
  type BoxedElement,
  type Tab,
  type ThemeDefinition,
} from '@livedocuments/document';
import { getResolvedAppearance } from '@livedocuments/ui';
import { lookupCustomTheme } from './custom-theme-registry';

// Pass through the shared engine so `@/lib/themes` stays the editor's theme API.
export {
  THEMES,
  recolourElementForTheme,
  recolourElementsForTheme,
  switchThemeElement,
  switchThemeElements,
  switchThemeBackdrop,
  resetThemeElement,
  resetThemeElementsToTheme,
  resetArrowsToTheme,
  shapeColorPresets,
  tableColorPresets,
  rederiveColorPresetForTheme,
  themePresetColors,
  themeChartPalette,
} from '@livedocuments/document';
export type { ThemeId, ThemeDefinition, ShapeColorPreset } from '@livedocuments/document';

// Resolve an id to its real ThemeDefinition, or `undefined` when the id names
// nothing we know — a deleted custom theme (docs/specs/011-theme/custom-themes.md), or a custom id whose owner
// fetch hasn't landed yet. Callers that must DISTINGUISH "unknown" from "the
// default theme" (setTheme's preserve-customs diff) branch on undefined; callers
// that always need something (getTheme) fall back to the default.
export function resolveTheme(
  id: string | undefined,
  appearance: Appearance = getResolvedAppearance(),
): ThemeDefinition | undefined {
  // Every scheme in the viewer's half (docs/specs/011-theme/light-and-dark.md): Default's hand-made halves, every
  // other built-in's and every custom theme's native or derived half.
  const source = themeSource(id);
  return source ? themeHalf(source, appearance) : undefined;
}

/** The scheme as written (its native half, before tuning): what its light / dark halves and its colour map are built
 *  from. Undefined for an id that names nothing known. */
function themeSource(id: string | undefined): ThemeDefinition | undefined {
  if (!id) return undefined;
  const custom = lookupCustomTheme(id);
  if (custom) return custom;
  if (id === DEFAULT_SCHEME_ID) return DEFAULT_SCHEME_LIGHT;
  return THEMES.find((t) => t.id === id);
}

/** Every colour the tab's scheme paints, in either half, mapped to the viewer's half (themeColourMap): what the canvas
 *  and the exports redraw a tab's elements through. Empty for a scheme nobody can resolve. */
export function themeViewMap(
  id: string | undefined,
  appearance: Appearance = getResolvedAppearance(),
): ReadonlyMap<string, string> {
  return themeColourMap(themeSource(id) ?? DEFAULT_SCHEME_LIGHT, appearance);
}

// Custom themes (docs/specs/011-theme/custom-themes.md) win: the editor registers the owner's saved themes
// into the module registry, so a `custom:<uuid>` id resolves here synchronously
// like any built-in. Falls through to the catalogue (and ultimately the default)
// when the id isn't a registered custom theme — including a deleted one, so a
// document never breaks. The MCP worker, which has no registry, uses
// getBuiltInTheme directly instead.
// `appearance` defaults to the CURRENT VIEWER's (the module-level appearance
// store, no React needed), so every one of the ~120 existing callers gets the
// right half of Default without passing anything. Callers rendering for
// someone else — an export, a thumbnail, a preview card pinned to one half —
// pass it explicitly.
export function getTheme(
  id: string | undefined,
  appearance: Appearance = getResolvedAppearance(),
): ThemeDefinition {
  return resolveTheme(id, appearance) ?? getBuiltInTheme(id, appearance);
}

// The backdrop a tab actually PAINTS, which is not always the backdrop it
// stores. A tab whose canvas is still its scheme's own (nobody has hand-picked a colour) follows the viewer's
// appearance instead: the scheme's light half in light chrome, its dark half in dark
// (docs/specs/011-theme/light-and-dark.md). The viewer's canvas lays the surround's pattern over it
// in resolveViewBackdrop. Nothing is written back —
// the document keeps whichever half was current when the scheme was applied,
// and every other viewer resolves it to their own.
//
// Only the two COLOURS swap. The pattern, its opacity and its scale are layout
// choices, identical in both appearances, so they pass straight through.
export type ResolvedBackdrop = {
  backgroundColor: string;
  patternColor: string;
  backgroundPattern: BackgroundPattern | undefined;
  backgroundOpacity: number | undefined;
};

export function resolveTabBackdrop(
  tab: Pick<
    Tab,
    'theme' | 'backgroundColor' | 'backgroundPattern' | 'patternColor' | 'backgroundOpacity'
  >,
  appearance: Appearance = getResolvedAppearance(),
): ResolvedBackdrop {
  const stored = {
    backgroundColor: tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    patternColor: tab.patternColor ?? DEFAULT_PATTERN_COLOR,
    backgroundPattern: tab.backgroundPattern,
    backgroundOpacity: tab.backgroundOpacity,
  };
  // A canvas or pattern colour the scheme painted, in either half, follows the viewer; a picked colour stays.
  const source = themeSource(tab.theme ?? DEFAULT_SCHEME_ID);
  if (!source) return stored;
  return { ...stored, ...viewBackdropInTheme(stored, source, appearance) };
}

// Colour projection for a NEWLY-added boxed element, given the active tab's
// background + pattern colour + theme. Two-pass: (1) derive colours from the
// tab's backdrop so a customised canvas drives the shape's fill / stroke / text;
// (2) apply the active theme's explicit element overrides on top (the theme
// always wins). Sticky notes keep their amber (return {}). Lives here, not in
// the package, because it resolves the (custom-aware) active theme via getTheme.
export function deriveNewBoxedColours(
  base: BoxedElement,
  tab: {
    backgroundColor?: string | null;
    patternColor?: string | null;
    theme?: string;
  },
): { fillColor?: string; strokeColor?: string; textColor?: string } {
  const colours: { fillColor?: string; strokeColor?: string; textColor?: string } = {};
  const bg = tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
  const patternColor = tab.patternColor ?? DEFAULT_PATTERN_COLOR;
  // The Default scheme paints nothing onto an element, in either appearance:
  // its whole trick is that an element carries no colour, so it can read as
  // dark ink to one viewer and light ink to another (docs/specs/007-editor/editor-app.md). Deriving from
  // the dark half's canvas here would bake one viewer's chrome into the
  // document for everybody. A canvas the USER coloured still derives normally —
  // that is their choice, and it is stored.
  if (
    (tab.theme === undefined || tab.theme === DEFAULT_SCHEME_ID) &&
    isDefaultSchemeBackdrop({ backgroundColor: bg, patternColor })
  ) {
    return colours;
  }
  if (base.type === 'shape') {
    const derived = deriveShapeColours(patternColor, bg);
    if (derived) {
      colours.fillColor = derived.fill;
      colours.strokeColor = derived.stroke;
      colours.textColor = derived.text;
    }
  } else if (base.type === 'text') {
    if (bg !== DEFAULT_BACKGROUND_COLOR) {
      colours.textColor = deriveTextColorForBg(bg);
    }
  } else if (base.type === 'table') {
    // Cells get a solid background matching the canvas so the pattern doesn't
    // bleed through; text contrasts with it. (Grid lines use the slate default.)
    colours.fillColor = bg;
    colours.textColor = deriveTextColorForBg(bg);
  }
  // Theme overrides win. Per-shape themes (UML) paint a shape KIND its own
  // colours; fall through to the theme's element colours otherwise.
  const theme = getTheme(tab.theme);
  const shapeOverride =
    base.type === 'shape' && theme.shapeColors ? theme.shapeColors[base.shape] : undefined;
  const elementFill = shapeOverride?.fill ?? theme.elementFill;
  const elementStroke = shapeOverride?.stroke ?? theme.elementStroke;
  const elementText = shapeOverride?.text ?? theme.elementText;
  if (base.type === 'shape') {
    if (elementFill) colours.fillColor = elementFill;
    if (elementStroke) colours.strokeColor = elementStroke;
    if (elementText) colours.textColor = elementText;
  } else if (base.type === 'text') {
    if (theme.elementText) colours.textColor = theme.elementText;
  } else if (base.type === 'table') {
    if (theme.elementText) colours.textColor = theme.elementText;
    if (theme.elementStroke) colours.strokeColor = theme.elementStroke;
  }
  return colours;
}
