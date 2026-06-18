// Preset theme catalogue (the THEMES array). Split out of themes.ts to keep
// each file under the ~1000-line budget; themes.ts imports THEMES from here
// and keeps the theme-resolution + element-recolouring logic. Pure data.
import type { ThemeDefinition } from './themes';

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
