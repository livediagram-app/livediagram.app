import type { PrismPalette, PrismScheme } from './prism';

// Each app's logo: the same Living Prism and `live` + name wordmark, in the app's own colours
// (every product's docs/specs/004-interface-design/brand-mark.md). The class strings are literal so
// Tailwind finds them when an app sources this package.
export type BrandApp = 'livediagram' | 'liveplanner' | 'livedocuments' | 'livedesign';

export type BrandIdentity = {
  // The wordmark after "live".
  word: string;
  // The prism palettes, as drawn in the app's Living Prism artwork. `vivid` is the anchor a theme
  // accent replaces; every other stop is placed relative to it.
  palettes: Record<PrismScheme, PrismPalette>;
  // "live" in the static lockup (marketing/media/logo/), and the ink beside it.
  lockup: Record<PrismScheme, { accent: string; ink: string }>;
  // "live" in the live wordmark when no accent is given: the app's brand-700, its 400 on dark.
  liveClass: string;
  // The wordmark gleam's colour on dark (its 300); white over light-mode ink.
  shineClass: string;
  // The app's light brand ramp as hex: `--color-brand-*` in its tailwind-config's `@theme` block (apps.test.ts keeps
  // them equal). For a colour drawn on the paper or mixed in code, which a class or `var()` cannot give, as the
  // chrome's `.dark` class redefines the tokens.
  ramp: Record<BrandStep, string>;
};

export type BrandStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

const INK = { light: '#0f172a', dark: '#f1f5f9' } as const;

export const BRAND_APPS: Record<BrandApp, BrandIdentity> = {
  livediagram: {
    word: 'diagram',
    // Sky into blue into deep indigo.
    palettes: {
      light: {
        light: '#38bdf8',
        vivid: '#0284c7',
        primary: '#2563eb',
        deep: '#1d4ed8',
        dark: '#1e1b4b',
        highlight: '#e0f2fe',
      },
      dark: {
        light: '#38bdf8',
        vivid: '#0ea5e9',
        primary: '#3b82f6',
        deep: '#1d4ed8',
        dark: '#0f172a',
        highlight: '#bae6fd',
      },
    },
    lockup: {
      light: { accent: '#0284c7', ink: INK.light },
      dark: { accent: '#38bdf8', ink: INK.dark },
    },
    liveClass: 'text-brand-700 dark:text-sky-400',
    shineClass: 'dark:[--ldm-shine:#7dd3fc]',
    ramp: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49',
    },
  },
  liveplanner: {
    word: 'planner',
    // Violet into purple.
    palettes: {
      light: {
        light: '#a78bfa',
        vivid: '#7c3aed',
        primary: '#9333ea',
        deep: '#7e22ce',
        dark: '#3b0764',
        highlight: '#ede9fe',
      },
      dark: {
        light: '#a78bfa',
        vivid: '#8b5cf6',
        primary: '#a855f7',
        deep: '#7e22ce',
        dark: '#0f172a',
        highlight: '#ddd6fe',
      },
    },
    lockup: {
      light: { accent: '#7c3aed', ink: INK.light },
      dark: { accent: '#a78bfa', ink: INK.dark },
    },
    liveClass: 'text-brand-700 dark:text-violet-400',
    shineClass: 'dark:[--ldm-shine:#c4b5fd]',
    ramp: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
      950: '#2e1065',
    },
  },
  livedocuments: {
    word: 'documents',
    // Amber into orange.
    palettes: {
      light: {
        light: '#fbbf24',
        vivid: '#d97706',
        primary: '#ea580c',
        deep: '#c2410c',
        dark: '#431407',
        highlight: '#fef3c7',
      },
      dark: {
        light: '#fbbf24',
        vivid: '#f59e0b',
        primary: '#f97316',
        deep: '#c2410c',
        dark: '#0f172a',
        highlight: '#fde68a',
      },
    },
    lockup: {
      light: { accent: '#a34a0c', ink: INK.light },
      dark: { accent: '#fbbf24', ink: INK.dark },
    },
    liveClass: 'text-brand-700 dark:text-amber-400',
    shineClass: 'dark:[--ldm-shine:#fcd34d]',
    ramp: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#c76508',
      700: '#a34a0c',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },
  },
  livedesign: {
    word: 'design',
    // Rose into pink.
    palettes: {
      light: {
        light: '#fb7185',
        vivid: '#e11d48',
        primary: '#db2777',
        deep: '#be185d',
        dark: '#500724',
        highlight: '#ffe4e6',
      },
      dark: {
        light: '#fb7185',
        vivid: '#f43f5e',
        primary: '#ec4899',
        deep: '#be185d',
        dark: '#0f172a',
        highlight: '#fecdd3',
      },
    },
    lockup: {
      light: { accent: '#be123c', ink: INK.light },
      dark: { accent: '#fb7185', ink: INK.dark },
    },
    liveClass: 'text-brand-700 dark:text-rose-400',
    shineClass: 'dark:[--ldm-shine:#fda4af]',
    ramp: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337',
      950: '#4c0519',
    },
  },
};
