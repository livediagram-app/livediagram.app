// The shared theme ENGINE (catalogue, types, recolour / switch / reset / preset
// transforms) now lives in @livediagram/diagram so the MCP worker (spec/62)
// themes diagrams identically to the editor. This file re-exports it and adds
// the LIVE-ONLY layer: custom-theme (per-owner, spec/44) resolution and the
// new-element colour derivation that depends on it. The ~120 `@/lib/themes`
// consumers are unchanged — every symbol they imported is still exported here.
import {
  getBuiltInTheme,
  THEMES,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  deriveShapeColours,
  deriveTextColorForBg,
  type BoxedElement,
  type ThemeDefinition,
} from '@livediagram/diagram';
import { lookupCustomTheme } from './custom-theme-registry';

// Pass through the shared engine so `@/lib/themes` stays the editor's theme API.
export {
  THEMES,
  getBuiltInTheme,
  recolourElementForTheme,
  recolourElementsForTheme,
  switchThemeElement,
  switchThemeElements,
  switchThemeBackdrop,
  resetThemeElement,
  resetThemeElementsToTheme,
  resetArrowsToTheme,
  shapeColorPresets,
  shapeColorPresetById,
  rederiveColorPresetForTheme,
  themePresetColors,
  themeChartPalette,
} from '@livediagram/diagram';
export type {
  ThemeId,
  ThemeDefinition,
  ThemeCategory,
  ShapeColorPreset,
  TabBackdrop,
} from '@livediagram/diagram';

// Resolve an id to its real ThemeDefinition, or `undefined` when the id names
// nothing we know — a deleted custom theme (spec/44), or a custom id whose owner
// fetch hasn't landed yet. Callers that must DISTINGUISH "unknown" from "the
// default theme" (setTheme's preserve-customs diff) branch on undefined; callers
// that always need something (getTheme) fall back to the default.
export function resolveTheme(id: string | undefined): ThemeDefinition | undefined {
  if (id) {
    const custom = lookupCustomTheme(id);
    if (custom) return custom;
  }
  return THEMES.find((t) => t.id === id);
}

// Custom themes (spec/44) win: the editor registers the owner's saved themes
// into the module registry, so a `custom:<uuid>` id resolves here synchronously
// like any built-in. Falls through to the catalogue (and ultimately the default)
// when the id isn't a registered custom theme — including a deleted one, so a
// diagram never breaks. The MCP worker, which has no registry, uses
// getBuiltInTheme directly instead.
export function getTheme(id: string | undefined): ThemeDefinition {
  return resolveTheme(id) ?? getBuiltInTheme(id);
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
  if (base.type === 'shape' || base.type === 'annotation') {
    // Annotation markers derive fill + stroke from the backdrop like a shape
    // does (text isn't used — the note is plain). See spec/38.
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
  if (base.type === 'shape' || base.type === 'annotation') {
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
