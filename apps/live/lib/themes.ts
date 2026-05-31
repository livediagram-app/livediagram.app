import type { BackgroundPattern } from '@livediagram/diagram';

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
  | 'emerald'
  | 'indigo'
  | 'plum'
  | 'steel'
  | 'honey'
  | 'coral';

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
    id: 'emerald',
    label: 'Emerald',
    backgroundColor: '#ecfdf5',
    backgroundPattern: 'grid',
    patternColor: '#a7f3d0',
    elementFill: '#d1fae5',
    elementStroke: '#047857',
    elementText: '#064e3b',
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
    id: 'plum',
    label: 'Plum',
    backgroundColor: '#fdf4ff',
    backgroundPattern: 'grid',
    patternColor: '#f5d0fe',
    elementFill: '#fae8ff',
    elementStroke: '#a21caf',
    elementText: '#701a75',
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
    id: 'honey',
    label: 'Honey',
    backgroundColor: '#fffbeb',
    backgroundPattern: 'grid',
    patternColor: '#fde68a',
    elementFill: '#fef3c7',
    elementStroke: '#b45309',
    elementText: '#78350f',
    extra: true,
  },
  {
    id: 'coral',
    label: 'Coral',
    backgroundColor: '#fff7ed',
    backgroundPattern: 'grid',
    patternColor: '#fdba74',
    elementFill: '#ffedd5',
    elementStroke: '#dc2626',
    elementText: '#7f1d1d',
    extra: true,
  },
];

export function getTheme(id: string | undefined): ThemeDefinition {
  const found = THEMES.find((t) => t.id === id);
  return found ?? THEMES[0]!;
}
