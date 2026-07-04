import type { Element } from './index';
import { assignBranches, branchOfArrow, ROOT_BRANCH } from './hierarchy';
import { rederiveColorPresetForTheme } from './theme-presets';
import {
  recolourElementForTheme,
  resetThemeElement,
  switchThemeElement,
  type ThemeDefinition,
  type ThemePaletteEntry,
} from './themes';

// Graph-aware theme transforms (spec/29 multi-colour themes), split out
// of themes.ts: the whole-element-list entry points that resolve each
// element's hierarchy branch before delegating to the per-element
// transforms themes.ts keeps.
//
// A palette theme paints each branch of the hierarchy a different hue
// instead of one colour for everything. Branch assignment needs the
// WHOLE element list (to read the pinned-arrow graph), so the three
// per-element transforms can't express it directly.
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
