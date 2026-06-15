import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  deriveShapeColours,
  deriveTextColorForBg,
  shade,
  tint,
  type BackgroundPattern,
  type BoxedElement,
  type Element,
  type ShapeKind,
} from '@livediagram/diagram';
import { assignBranches, branchOfArrow, ROOT_BRANCH } from './hierarchy';
import { lookupCustomTheme } from './custom-theme-registry';

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
export type ShapeColourOverride = { fill?: string; stroke?: string; text?: string };

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

export const THEMES: ThemeDefinition[] = [
  {
    // `id` stays 'brand' (saved diagrams reference it); only the
    // user-facing label is "Basic" — the plain, un-themed default.
    id: 'brand',
    label: 'Basic',
    backgroundColor: '#ffffff',
    backgroundPattern: 'grid',
    patternColor: '#cbd5e1',
    elementFill: null,
    elementStroke: null,
    elementText: null,
  },
  {
    // Pink. The id stays 'slate' for save-compatibility (see the ThemeId
    // union) — the original grey Slate was dropped for being a near-dupe
    // of Steel / Charcoal / Mono.
    id: 'slate',
    label: 'Pink',
    backgroundColor: '#fdf2f8',
    backgroundPattern: 'grid',
    patternColor: '#fbcfe8',
    elementFill: '#fce7f3',
    elementStroke: '#db2777',
    elementText: '#9d174d',
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
    id: 'sky',
    label: 'Sky',
    backgroundColor: '#f0f9ff',
    backgroundPattern: 'grid',
    patternColor: '#bae6fd',
    elementFill: '#e0f2fe',
    elementStroke: '#0369a1',
    elementText: '#0c4a6e',
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
  {
    id: 'plum',
    label: 'Plum',
    // Deep violet dark theme — the purple counterpart to Midnight's
    // navy and Pine's forest green.
    backgroundColor: '#241436',
    backgroundPattern: 'grid',
    patternColor: '#3b2563',
    elementFill: '#3b2563',
    elementStroke: '#c4b5fd',
    elementText: '#ede9fe',
    extra: true,
  },
  {
    id: 'abyss',
    label: 'Abyss',
    // Deep teal dark theme — a cold underwater base with bright
    // aqua foliage tones on elements.
    backgroundColor: '#042f2e',
    backgroundPattern: 'grid',
    patternColor: '#134e4a',
    elementFill: '#134e4a',
    elementStroke: '#5eead4',
    elementText: '#ccfbf1',
    extra: true,
  },
  {
    id: 'espresso',
    label: 'Espresso',
    // Dark warm brown — the dark counterpart to Mocha, for a cosy
    // coffee-toned canvas.
    backgroundColor: '#231a12',
    backgroundPattern: 'grid',
    patternColor: '#3b2a1a',
    elementFill: '#3b2a1a',
    elementStroke: '#d6b78f',
    elementText: '#f5e9da',
    extra: true,
  },
  // --- Multi-colour themes (spec/29) ---------------------------------
  // Each tints a different branch of the hierarchy with its own hue.
  // `elementFill / -Stroke / -Text` mirror the `rootColor` so any code
  // path that reads the single-colour fields (or a non-hierarchy
  // diagram) still gets a sensible neutral.
  {
    id: 'rainbow',
    label: 'Rainbow',
    // Rainbow tints the ELEMENTS (the per-branch palette below); the
    // canvas stays a plain grid on a faint warm tint. The Confetti
    // backdrop is deliberately NOT used here — it's an "out there"
    // canvas that users should opt into by hand from the background
    // picker, not get foisted on them by choosing a colourful theme.
    backgroundColor: '#fffdf7',
    backgroundPattern: 'grid',
    patternColor: '#e2e8f0',
    elementFill: '#f8fafc',
    elementStroke: '#475569',
    elementText: '#0f172a',
    rootColor: { fill: '#f8fafc', stroke: '#475569', text: '#0f172a' },
    // A saturated six-hue spectrum: red → orange → amber → green →
    // blue → violet. Light tinted fills with a deep stroke + text so
    // labels stay legible on white.
    palette: [
      { fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
      { fill: '#ffedd5', stroke: '#ea580c', text: '#7c2d12' },
      { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' },
      { fill: '#dcfce7', stroke: '#16a34a', text: '#14532d' },
      { fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' },
      { fill: '#f3e8ff', stroke: '#9333ea', text: '#581c87' },
    ],
    extra: true,
  },
  {
    id: 'pastel',
    label: 'Pastel',
    // Soft lilac canvas so the backdrop shifts off white and matches
    // the gentle palette.
    backgroundColor: '#fbf7fe',
    backgroundPattern: 'grid',
    patternColor: '#ede9fe',
    elementFill: '#faf5ff',
    elementStroke: '#a1a1aa',
    elementText: '#3f3f46',
    rootColor: { fill: '#faf5ff', stroke: '#a1a1aa', text: '#3f3f46' },
    // The same wheel as Rainbow but softer: lighter strokes, gentler
    // fills, for a calmer multi-colour look.
    palette: [
      { fill: '#ffe4e6', stroke: '#fb7185', text: '#9f1239' },
      { fill: '#ffedd5', stroke: '#fb923c', text: '#9a3412' },
      { fill: '#fef9c3', stroke: '#facc15', text: '#854d0e' },
      { fill: '#d1fae5', stroke: '#34d399', text: '#065f46' },
      { fill: '#e0f2fe', stroke: '#38bdf8', text: '#075985' },
      { fill: '#ede9fe', stroke: '#a78bfa', text: '#5b21b6' },
    ],
    extra: true,
  },
  {
    id: 'tropical',
    label: 'Tropical',
    // Faint teal canvas to match the bright, summery palette.
    backgroundColor: '#f0fdfa',
    backgroundPattern: 'grid',
    patternColor: '#99f6e4',
    elementFill: '#f0fdfa',
    elementStroke: '#475569',
    elementText: '#0f172a',
    rootColor: { fill: '#f0fdfa', stroke: '#475569', text: '#0f172a' },
    // A vivid teal → cyan → lime → orange → pink → violet spread; reads
    // brighter and more "summery" than Rainbow's primary-colour wheel.
    palette: [
      { fill: '#ccfbf1', stroke: '#0d9488', text: '#134e4a' },
      { fill: '#cffafe', stroke: '#0891b2', text: '#155e75' },
      { fill: '#ecfccb', stroke: '#65a30d', text: '#365314' },
      { fill: '#ffedd5', stroke: '#f97316', text: '#7c2d12' },
      { fill: '#fce7f3', stroke: '#db2777', text: '#831843' },
      { fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' },
    ],
    extra: true,
  },
  {
    id: 'autumn',
    label: 'Autumn',
    // Warm seasonal multi-colour: reds, oranges, ambers and golds
    // through to brown and olive, on a faint warm canvas. Reads
    // cohesively "autumnal" rather than spanning the full wheel.
    backgroundColor: '#fffaf5',
    backgroundPattern: 'grid',
    patternColor: '#fed7aa',
    elementFill: '#fffaf5',
    elementStroke: '#7c2d12',
    elementText: '#431407',
    rootColor: { fill: '#fffaf5', stroke: '#7c2d12', text: '#431407' },
    palette: [
      { fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
      { fill: '#ffedd5', stroke: '#ea580c', text: '#7c2d12' },
      { fill: '#fef3c7', stroke: '#d97706', text: '#78350f' },
      { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' },
      { fill: '#f5ede0', stroke: '#92400e', text: '#451a03' },
      { fill: '#ecfccb', stroke: '#65a30d', text: '#365314' },
    ],
    extra: true,
  },
  {
    id: 'jewel',
    label: 'Jewel',
    // Rich, saturated gem tones — emerald, sapphire, amethyst, ruby,
    // topaz, teal — deeper and more luxurious than Rainbow's primary
    // wheel, on a faint neutral canvas.
    backgroundColor: '#fbfbfd',
    backgroundPattern: 'grid',
    patternColor: '#e2e8f0',
    elementFill: '#fbfbfd',
    elementStroke: '#334155',
    elementText: '#0f172a',
    rootColor: { fill: '#fbfbfd', stroke: '#334155', text: '#0f172a' },
    palette: [
      { fill: '#d1fae5', stroke: '#059669', text: '#064e3b' },
      { fill: '#dbeafe', stroke: '#1d4ed8', text: '#1e3a8a' },
      { fill: '#f3e8ff', stroke: '#7e22ce', text: '#581c87' },
      { fill: '#ffe4e6', stroke: '#e11d48', text: '#881337' },
      { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' },
      { fill: '#cffafe', stroke: '#0e7490', text: '#155e75' },
    ],
    extra: true,
  },
  {
    // UML (spec/42): a formal-notation theme. Instead of one colour for
    // every shape, each shape KIND gets its conventional fill / stroke /
    // text so a diagram reads as UML at a glance — a decision diamond is
    // amber, a datastore cylinder is purple, a terminator is green, and
    // so on. The base element colours are the classic crisp dark-on-light
    // box for any kind without an override; the canvas is plain white so
    // the colour coding carries the meaning, not the backdrop.
    id: 'uml',
    label: 'UML',
    backgroundColor: '#ffffff',
    backgroundPattern: 'blank',
    patternColor: '#e2e8f0',
    elementFill: '#f8fafc',
    elementStroke: '#334155',
    elementText: '#0f172a',
    shapeColors: {
      // Class / object / process box — UML's primary blue.
      square: { fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' },
      // Decision / guard — amber, the universal "branch here".
      diamond: { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
      // Start / end terminator — green "go".
      stadium: { fill: '#dcfce7', stroke: '#16a34a', text: '#14532d' },
      // Initial / final state node — rose.
      circle: { fill: '#ffe4e6', stroke: '#e11d48', text: '#881337' },
      // Datastore / database — purple.
      cylinder: { fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' },
      // Input / output data — teal.
      parallelogram: { fill: '#ccfbf1', stroke: '#0d9488', text: '#134e4a' },
      // Preparation — orange.
      hexagon: { fill: '#ffedd5', stroke: '#ea580c', text: '#7c2d12' },
      // Document / artefact — neutral slate.
      document: { fill: '#f1f5f9', stroke: '#475569', text: '#1e293b' },
      // Merge / extension — indigo.
      triangle: { fill: '#e0e7ff', stroke: '#4f46e5', text: '#312e81' },
      // Manual operation — lime.
      trapezoid: { fill: '#ecfccb', stroke: '#65a30d', text: '#365314' },
      // System / boundary — sky.
      cloud: { fill: '#e0f2fe', stroke: '#0284c7', text: '#075985' },
      // Annotation / emphasis — yellow.
      star: { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' },
    },
    // Behind "Show more" in the flat grids; always visible in its own
    // Formal category in the theme browser.
    extra: true,
  },
];

// Picker grouping, mirroring the template catalogue's categories. Themes
// are bucketed by colour temperament so the picker reads as titled
// sections (Cool / Warm / Neutral / Multi-colour) instead of one flat
// grid. The mapping lives beside the catalogue so a new theme slots into
// a section with a one-line edit; the picker renders sections in
// THEME_CATEGORIES order and skips empties.
export type ThemeCategory = 'cool' | 'warm' | 'dark' | 'multicolour' | 'formal';

// Short, user-facing blurb per built-in theme, shown under the label on
// the picker's theme cards (spec/14). A `Record<ThemeId, string>` so the
// compiler forces every theme to carry one: add a ThemeId without a line
// here and the build fails, which is how this can't drift from THEMES.
// Custom themes have no entry (their card shows just the saved name).
const THEME_DESCRIPTIONS: Record<ThemeId, string> = {
  brand: 'The plain, un-themed default.',
  slate: 'Soft pinks on a blush canvas.',
  forest: 'Deep greens on a leafy canvas.',
  sunset: 'Warm oranges and burnt amber.',
  lavender: 'Gentle purples on pale violet.',
  mono: 'Crisp black on white, no grid.',
  ocean: 'Cool cyans on a sea-glass canvas.',
  sky: 'Bright blues on a clear canvas.',
  midnight: 'Light slate on deep navy.',
  cream: 'Golden tones on warm ivory.',
  rose: 'Rich reds on a soft pink canvas.',
  sand: 'Neutral stone and warm greys.',
  olive: 'Muted greens on a pale lime canvas.',
  indigo: 'Deep indigo on a cool canvas.',
  pine: 'Light foliage on forest green.',
  steel: 'Cool greys with a slate edge.',
  mocha: 'Coffee browns on warm cream.',
  charcoal: 'Neutral greys on near-black.',
  plum: 'Soft violets on deep plum.',
  abyss: 'Aqua tones on deep teal.',
  espresso: 'Warm tan on dark-roast brown.',
  rainbow: 'A different hue per branch.',
  pastel: 'Soft multi-colour, a hue per branch.',
  tropical: 'Bright, summery hues per branch.',
  autumn: 'Warm reds, golds and browns.',
  jewel: 'Rich, saturated gem tones.',
  uml: 'Standard notation, each shape its colour.',
};

// The blurb for a theme id, or undefined for an unknown / custom id.
export function themeDescription(id: string): string | undefined {
  return (THEME_DESCRIPTIONS as Record<string, string>)[id];
}

export const THEME_CATEGORIES: { id: ThemeCategory; label: string; description: string }[] = [
  { id: 'cool', label: 'Cool', description: 'Blues, greens and purples.' },
  { id: 'warm', label: 'Warm', description: 'Reds, oranges and earthy tones.' },
  { id: 'dark', label: 'Dark', description: 'Dark-backdrop themes.' },
  { id: 'multicolour', label: 'Multi-colour', description: 'A different hue per branch.' },
  { id: 'formal', label: 'Formal', description: 'Standard notations like UML.' },
];

const THEME_CATEGORY: Record<ThemeId, ThemeCategory> = {
  // Cool: blues / greens / purples, plus the greyscale Mono.
  brand: 'cool',
  forest: 'cool',
  ocean: 'cool',
  sky: 'cool',
  lavender: 'cool',
  indigo: 'cool',
  steel: 'cool',
  mono: 'cool',
  // Warm: reds / oranges / pinks / earthy browns.
  slate: 'warm', // legacy id, now the Pink theme
  sunset: 'warm',
  rose: 'warm',
  cream: 'warm',
  sand: 'warm',
  mocha: 'warm',
  olive: 'warm',
  // Dark: dark-backdrop themes.
  midnight: 'dark',
  charcoal: 'dark',
  pine: 'dark',
  plum: 'dark',
  abyss: 'dark',
  espresso: 'dark',
  // Multi-colour "rainbow" themes (spec/29).
  rainbow: 'multicolour',
  pastel: 'multicolour',
  tropical: 'multicolour',
  autumn: 'multicolour',
  jewel: 'multicolour',
  // Formal notations.
  uml: 'formal',
};

export function themeCategory(id: ThemeId): ThemeCategory {
  return THEME_CATEGORY[id];
}

export function getTheme(id: string | undefined): ThemeDefinition {
  // Custom themes (spec/44) win: the editor registers the owner's saved
  // themes into the module registry, so a `custom:<uuid>` id resolves
  // here synchronously like any built-in. Falls through to the catalogue
  // (and ultimately the default) when the id isn't a registered custom
  // theme — including a deleted one, so a diagram never breaks.
  if (id) {
    const custom = lookupCustomTheme(id);
    if (custom) return custom;
  }
  const found = THEMES.find((t) => t.id === id);
  return found ?? THEMES[0]!;
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
};

export function switchThemeBackdrop(
  current: TabBackdrop,
  prev: ThemeDefinition,
  next: ThemeDefinition,
): Required<TabBackdrop> {
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
  return elements.map((el) => recolourElementForTheme(el, elementThemeView(theme, el, branches)));
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
    switchThemeElement(
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

// Colour projection for a NEWLY-added boxed element, given the
// active tab's background + pattern colour + theme. Two-pass:
//
//   1. Derive colours from the tab's backdrop. A tab whose
//      backgroundColor / patternColor stayed at the design defaults
//      gets nothing (deriveShapeColours returns null); a customised
//      backdrop drives the new shape's fill / stroke / text so it
//      sits on the canvas with intentional contrast. Text elements
//      pick up a backdrop-tuned textColor (white -> dark slate,
//      dark -> light slate).
//
//   2. Apply the active theme's explicit element-fill / -stroke /
//      -text overrides on top. The theme always wins over the
//      backdrop-derived guess (a Slate theme on a brand-cyan
//      backdrop should still produce Slate-coloured shapes).
//
// Sticky notes keep their amber palette regardless: they return
// `{}` so the caller's spread doesn't paint over the iconic
// yellow. Matches the rule used by recolourElementForTheme.
//
// Pure function, so the contract ("which colours land on a brand-
// new element") is testable without rendering anything.
export function deriveNewBoxedColours(
  base: BoxedElement,
  tab: {
    backgroundColor?: string | null;
    patternColor?: string | null;
    theme?: string;
  },
): { fillColor?: string; strokeColor?: string; textColor?: string } {
  // Narrow return: only the three fields common to shape / sticky /
  // text, never anything from ImageElement (which has no colour
  // fields, see spec/19). Callers spread the result onto any boxed
  // element; the missing-from-Image fields are no-ops at that point.
  const colours: { fillColor?: string; strokeColor?: string; textColor?: string } = {};
  const bg = tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
  const patternColor = tab.patternColor ?? DEFAULT_PATTERN_COLOR;
  if (base.type === 'shape' || base.type === 'annotation') {
    // Annotation markers derive fill + stroke from the backdrop the same
    // way a shape does (text isn't used — the note is plain). See spec/38.
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
    // Give cells a solid background matching the canvas base colour so
    // the backdrop pattern doesn't bleed through and make text hard to
    // read; derive the text colour to contrast with it. (Grid lines use
    // the slate-400 default, which reads on both light and dark.)
    colours.fillColor = bg;
    colours.textColor = deriveTextColorForBg(bg);
  }
  // Theme overrides win. Sticky stays untouched (returns colours
  // empty for that branch).
  const theme = getTheme(tab.theme);
  // Per-shape themes (UML) paint a shape KIND its own colours; fall
  // through to the theme's element colours for kinds without an
  // override. Only shapes carry a `shape` kind.
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
