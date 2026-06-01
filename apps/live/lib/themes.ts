import type { BackgroundPattern, Element } from '@livediagram/diagram';

// A preset theme bundles a canvas backdrop (background colour + pattern +
// pattern colour) with the default colours used for newly added boxed
// elements. Picking a theme from the palette's Current Tab section
// updates both halves at once; existing elements are unaffected. Themes
// are referenced by string id (stored on Tab.theme) so they survive
// renames + can be extended without breaking saved diagrams.

export type ThemeId =
  | 'brand'
  | 'slate'
  | 'forest'
  | 'sunset'
  | 'lavender'
  | 'mono'
  | 'ocean'
  | 'crimson'
  | 'midnight'
  | 'cream'
  | 'rose'
  | 'sand'
  | 'olive'
  | 'indigo'
  | 'pine'
  | 'steel'
  | 'mocha'
  | 'charcoal';

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  // Backdrop.
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  patternColor: string;
  // Defaults for newly added boxed elements. `null` means "fall through
  // to the type-default" — used by the brand theme so it stays identical
  // to the un-themed default.
  elementFill: string | null;
  elementStroke: string | null;
  elementText: string | null;
  // True for themes that sit behind the picker's "Show more" toggle —
  // both in the welcome / template picker AND in the Current Tab theme
  // grid. The default twelve render in the first batch; extras unlock
  // on click so the grids stay compact for first-time users.
  extra?: boolean;
};

export const THEMES: ThemeDefinition[] = [
  {
    id: 'brand',
    label: 'Brand',
    backgroundColor: '#ffffff',
    backgroundPattern: 'grid',
    patternColor: '#cbd5e1',
    elementFill: null,
    elementStroke: null,
    elementText: null,
  },
  {
    id: 'slate',
    label: 'Slate',
    backgroundColor: '#f8fafc',
    backgroundPattern: 'grid',
    patternColor: '#cbd5e1',
    elementFill: '#f1f5f9',
    elementStroke: '#475569',
    elementText: '#0f172a',
  },
  {
    id: 'forest',
    label: 'Forest',
    backgroundColor: '#f0fdf4',
    backgroundPattern: 'grid',
    patternColor: '#bbf7d0',
    elementFill: '#dcfce7',
    elementStroke: '#15803d',
    elementText: '#14532d',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    backgroundColor: '#fff7ed',
    backgroundPattern: 'grid',
    patternColor: '#fed7aa',
    elementFill: '#ffedd5',
    elementStroke: '#c2410c',
    elementText: '#7c2d12',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    backgroundColor: '#faf5ff',
    backgroundPattern: 'grid',
    patternColor: '#e9d5ff',
    elementFill: '#f3e8ff',
    elementStroke: '#7e22ce',
    elementText: '#581c87',
  },
  {
    id: 'mono',
    label: 'Mono',
    backgroundColor: '#ffffff',
    backgroundPattern: 'blank',
    patternColor: '#e2e8f0',
    elementFill: '#ffffff',
    elementStroke: '#0f172a',
    elementText: '#0f172a',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    backgroundColor: '#ecfeff',
    backgroundPattern: 'grid',
    patternColor: '#a5f3fc',
    elementFill: '#cffafe',
    elementStroke: '#0e7490',
    elementText: '#164e63',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    backgroundColor: '#fef2f2',
    backgroundPattern: 'grid',
    patternColor: '#fecaca',
    elementFill: '#fee2e2',
    elementStroke: '#b91c1c',
    elementText: '#7f1d1d',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    backgroundColor: '#0f172a',
    backgroundPattern: 'grid',
    patternColor: '#1e293b',
    elementFill: '#1e293b',
    elementStroke: '#94a3b8',
    elementText: '#e2e8f0',
  },
  {
    id: 'cream',
    label: 'Cream',
    backgroundColor: '#fefce8',
    backgroundPattern: 'grid',
    patternColor: '#fef08a',
    elementFill: '#fef9c3',
    elementStroke: '#a16207',
    elementText: '#713f12',
  },
  {
    id: 'rose',
    label: 'Rose',
    backgroundColor: '#fff1f2',
    backgroundPattern: 'grid',
    patternColor: '#fecdd3',
    elementFill: '#ffe4e6',
    elementStroke: '#be123c',
    elementText: '#881337',
  },
  {
    id: 'sand',
    label: 'Sand',
    backgroundColor: '#fafaf9',
    backgroundPattern: 'grid',
    patternColor: '#e7e5e4',
    elementFill: '#f5f5f4',
    elementStroke: '#78716c',
    elementText: '#292524',
  },
  {
    id: 'olive',
    label: 'Olive',
    backgroundColor: '#f7fee7',
    backgroundPattern: 'grid',
    patternColor: '#d9f99d',
    elementFill: '#ecfccb',
    elementStroke: '#4d7c0f',
    elementText: '#365314',
    extra: true,
  },
  {
    id: 'indigo',
    label: 'Indigo',
    backgroundColor: '#eef2ff',
    backgroundPattern: 'grid',
    patternColor: '#c7d2fe',
    elementFill: '#e0e7ff',
    elementStroke: '#4338ca',
    elementText: '#312e81',
    extra: true,
  },
  {
    id: 'pine',
    label: 'Pine',
    // Dark green canvas with light foliage tones on elements.
    // Sits in the "dark theme" tier alongside Midnight + Charcoal
    // but with a forest-green base instead of navy or neutral grey.
    backgroundColor: '#14532d',
    backgroundPattern: 'grid',
    patternColor: '#166534',
    elementFill: '#166534',
    elementStroke: '#86efac',
    elementText: '#dcfce7',
    extra: true,
  },
  {
    id: 'steel',
    label: 'Steel',
    backgroundColor: '#f1f5f9',
    backgroundPattern: 'grid',
    patternColor: '#94a3b8',
    elementFill: '#e2e8f0',
    elementStroke: '#334155',
    elementText: '#0f172a',
    extra: true,
  },
  {
    id: 'mocha',
    label: 'Mocha',
    // True warm brown — the palette has no genuine brown otherwise
    // (Sand and Cream are both pale-yellow neutrals). Coffee-amber
    // tones on a cream canvas.
    backgroundColor: '#fef7e6',
    backgroundPattern: 'grid',
    patternColor: '#e7d4b8',
    elementFill: '#e7d4b8',
    elementStroke: '#78350f',
    elementText: '#451a03',
    extra: true,
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    // Neutral-grey dark theme — distinct from Midnight (which is
    // blue-shifted slate) and from Mono (which is pure white).
    backgroundColor: '#18181b',
    backgroundPattern: 'grid',
    patternColor: '#27272a',
    elementFill: '#27272a',
    elementStroke: '#a1a1aa',
    elementText: '#f4f4f5',
    extra: true,
  },
];

export function getTheme(id: string | undefined): ThemeDefinition {
  const found = THEMES.find((t) => t.id === id);
  return found ?? THEMES[0]!;
}

// Apply a theme's element-colour overrides to a single Element,
// returning a new element with the theme's fill / stroke / text
// fields written when present, and untouched otherwise. Sticky notes
// keep their amber identity (the yellow note is iconic) regardless
// of theme, matching the rule `addBoxed` applies to ad-hoc sticky
// creation. Used by both the /live/new template path (templates.ts)
// and the in-editor "Browse templates" picker (editor-page.tsx) so
// the two paths can't drift, e.g. by accidentally omitting arrows.
export function recolourElementForTheme(el: Element, theme: ThemeDefinition): Element {
  if (el.type === 'shape') {
    return {
      ...el,
      ...(theme.elementFill ? { fillColor: theme.elementFill } : {}),
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
      ...(theme.elementText ? { textColor: theme.elementText } : {}),
    };
  }
  if (el.type === 'text') {
    return {
      ...el,
      ...(theme.elementText ? { textColor: theme.elementText } : {}),
    };
  }
  if (el.type === 'arrow') {
    return {
      ...el,
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
    };
  }
  return el;
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
// stroke while keeping its fill. Sticky notes stay untouched (same
// rule as `recolourElementForTheme`).
export function switchThemeElement(
  el: Element,
  prev: ThemeDefinition,
  next: ThemeDefinition,
): Element {
  const pick = (current: string | undefined, prevVal: string | null, nextVal: string | null) =>
    current === undefined || current === prevVal ? (nextVal ?? undefined) : current;
  if (el.type === 'shape') {
    return {
      ...el,
      fillColor: pick(el.fillColor, prev.elementFill, next.elementFill),
      strokeColor: pick(el.strokeColor, prev.elementStroke, next.elementStroke),
      textColor: pick(el.textColor, prev.elementText, next.elementText),
    };
  }
  if (el.type === 'text') {
    return {
      ...el,
      textColor: pick(el.textColor, prev.elementText, next.elementText),
    };
  }
  if (el.type === 'arrow') {
    return {
      ...el,
      strokeColor: pick(el.strokeColor, prev.elementStroke, next.elementStroke),
    };
  }
  return el;
}

// Hard reset: force every themable colour on every shape / text /
// arrow back to the current theme's value, OVERWRITING any custom
// per-element colours the user set. Surfaces as "Reset elements to
// theme" under the Theme accordion. Sticky notes stay untouched.
//
// Difference vs `recolourElementForTheme`: when the theme's value
// is null (e.g. the Brand theme has no element-fill override), the
// reset BLANKS the element's field (sets it to undefined) rather
// than leaving the existing custom value in place. Recolour-for-
// theme is "apply when present", reset is "make match the theme,
// blank when the theme blanks".
export function resetThemeElement(el: Element, theme: ThemeDefinition): Element {
  if (el.type === 'shape') {
    return {
      ...el,
      fillColor: theme.elementFill ?? undefined,
      strokeColor: theme.elementStroke ?? undefined,
      textColor: theme.elementText ?? undefined,
    };
  }
  if (el.type === 'text') {
    return { ...el, textColor: theme.elementText ?? undefined };
  }
  if (el.type === 'arrow') {
    return { ...el, strokeColor: theme.elementStroke ?? undefined };
  }
  return el;
}
