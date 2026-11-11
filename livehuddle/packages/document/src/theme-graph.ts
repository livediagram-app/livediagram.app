import type { Element } from './index';
import { assignBranches } from './hierarchy';
import { rederiveColorPresetForTheme } from './theme-presets';
import { rederiveQuickSwatches } from './quick-swatch-rederive';
import {
  recolourElementForTheme,
  resetThemeElement,
  switchThemeElement,
  type ThemeDefinition,
  type ThemePaletteEntry,
} from './themes';

// Graph-aware theme transforms (docs/specs/011-theme/multicolour-themes.md multi-colour themes), split out
// of themes.ts: the whole-element-list entry points that resolve each
// element's hierarchy branch before delegating to the per-element
// transforms themes.ts keeps.
//
// A palette theme paints each boxed element the next hue in document order
// instead of one colour for everything (DEFAULTS.md D34 in
// docs/specs/002-project-scope/blueprints). Branch assignment needs the
// WHOLE element list, so the three per-element transforms can't express it
// directly.
//
// The trick: for a palette theme we resolve each element's branch
// colours and hand the existing per-element transform a SYNTHETIC theme
// whose elementFill / -Stroke / -Text are that element's branch colours.
// Every existing rule (sticky / image opt-out, themeLockFill, the table
// backdrop handling) then applies unchanged — there's no second code
// path to keep in sync. Single-colour themes skip all of this and fall
// straight through to the per-element helpers.

// The trunk colour of last resort: a palette theme with no rootColor and a
// null element colour (Tailwind slate-100 / 600 / 900).
export const TRUNK_FALLBACK: ThemePaletteEntry = {
  fill: '#f1f5f9',
  stroke: '#475569',
  text: '#0f172a',
};

type PaletteOp = 'recolour' | 'switch' | 'reset';

// The branch map for one wrapper call, logged once. The walk itself never
// logs: it runs inside every wrapper, so the wrapper owns the trace.
function branchMapFor(
  op: PaletteOp,
  theme: ThemeDefinition,
  elements: Element[],
): Map<string, number> {
  const branches = assignBranches(elements);
  console.info(
    `[theme-graph] ${op} theme=${theme.id} elements=${elements.length} branches=${branches.size}`,
  );
  if (theme.palette?.length === 0) {
    console.warn(`[theme-graph] empty palette theme=${theme.id}, painting trunk`);
  }
  return branches;
}

// The branch colours a given element should be painted with under a
// palette theme: the palette entry for its branch, or the trunk colour
// (rootColor) for an element with no branch (a stored arrow) and for every
// element when the palette is empty.
function branchEntryFor(
  theme: ThemeDefinition,
  el: Element,
  branches: Map<string, number>,
): ThemePaletteEntry {
  const palette = theme.palette!;
  const root = theme.rootColor ?? {
    fill: theme.elementFill ?? TRUNK_FALLBACK.fill,
    stroke: theme.elementStroke ?? TRUNK_FALLBACK.stroke,
    text: theme.elementText ?? TRUNK_FALLBACK.text,
  };
  const index = branches.get(el.id);
  if (index === undefined || palette.length === 0) return root;
  return palette[index % palette.length]!;
}

// A per-element theme view: the same theme, but with its single-colour
// element fields swapped for this element's branch colours (palette
// themes). Identity for a plain single-colour theme, so every transform
// (recolour / switch / reset) is branch-aware through one code path. A
// theme's per-shape overrides (UML's) named only the diagram shapes, which
// are retired and keep their stored colours, so none applies (D34).
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
  return view;
}

// A preset-bound element, re-derived for `theme`, or null when it carries no
// binding. A shape carries `colorPreset` (the user picked a LOOK, not colours), so both theme walks ask this one
// question.
function rederivePresetForTheme(el: Element, theme: ThemeDefinition): Element | null {
  // A binding the theme cannot express (a 'branch-3' look under a
  // single-accent theme) still answers: the element keeps the colours it has
  // rather than being walked through the preserve-customs path, which is what
  // the shape side has always done.
  if (el.type === 'shape' && el.colorPreset) return rederiveColorPresetForTheme(el, theme);
  return null;
}

// Graph-aware counterpart to `recolourElementForTheme`: paints a fresh
// scaffold (template / Markdown import) with a theme, rainbowing the
// branches when the theme has a palette. Used by every "apply a theme to
// these elements" path so single- and multi-colour themes share one
// entry point.
export function recolourElementsForTheme(elements: Element[], theme: ThemeDefinition): Element[] {
  const branches = theme.palette ? branchMapFor('recolour', theme, elements) : null;
  return elements.map((el) =>
    // A quick-swatch binding (docs/specs/008-canvas/quick-style-panel.md) is re-read last, from the theme
    // itself, so a slot is one colour whatever branch the element sits on.
    rederiveQuickSwatches(
      // An element bound to a preset (docs/specs/010-palette/style-presets.md) takes the preset's variant for
      // this theme, not the plain branch / base colours — so a template's Bold
      // key element stays Bold in whatever theme it's built with.
      rederivePresetForTheme(el, theme) ??
        recolourElementForTheme(el, elementThemeView(theme, el, branches)),
      theme,
    ),
  );
}

// Graph-aware counterpart to `switchThemeElement`: the in-editor
// "pick a theme" path. The branch map depends only on the elements, so one
// map serves whichever side is a palette theme, and the preserve-customs
// comparison sees the right per-element colours.
export function switchThemeElements(
  elements: Element[],
  prev: ThemeDefinition,
  next: ThemeDefinition,
): Element[] {
  const branches =
    prev.palette || next.palette
      ? branchMapFor('switch', next.palette ? next : prev, elements)
      : null;
  const prevBranches = prev.palette ? branches : null;
  const nextBranches = next.palette ? branches : null;
  return elements.map((el) =>
    rederiveQuickSwatches(
      // Preset-bound elements (docs/specs/010-palette/style-presets.md) re-derive their preset for the new
      // theme instead of being preserved as a manual override: picking a new
      // theme moves a Bold-preset shape, or a Banded table, to that theme's
      // version of the look rather than stranding it on the old colours.
      rederivePresetForTheme(el, next) ??
        switchThemeElement(
          el,
          elementThemeView(prev, el, prevBranches),
          elementThemeView(next, el, nextBranches),
        ),
      next,
    ),
  );
}

// Graph-aware counterpart to `resetThemeElement`: the "Reset elements to
// theme" button. Force-repaints every branch from the palette.
export function resetThemeElementsToTheme(elements: Element[], theme: ThemeDefinition): Element[] {
  const branches = theme.palette ? branchMapFor('reset', theme, elements) : null;
  return elements.map((el) =>
    rederiveQuickSwatches(resetThemeElement(el, elementThemeView(theme, el, branches)), theme),
  );
}
