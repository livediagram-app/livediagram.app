// The Overview's style (docs/specs/026-plan/plan-overview.md "Style"): how a Style panel pick changes it (the very transforms a tab's picks run, on a stand-in tab), and the
// page surface it resolves to. Pure, so the page resolves it once per change and tests read it plainly.
import type { CSSProperties } from 'react';
import { readOverviewStyle, type OverviewStyle } from '@liveplanner/api-schema';
import { resolveFontStack, type Appearance, type Tab, type TextSize } from '@liveplanner/project';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { pickStyle } from './overview-look';
import { isDarkCanvas } from '@/lib/dark-canvas';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { getTheme } from '@/lib/themes';
import { overviewHeaderPaint, overviewHeaderVars } from './overview-header-paint';

// A run of picks closer together than this (a slider's drag) is one save and one undo step.
export const OVERVIEW_STYLE_SAVE_MS = 400;

// The look after one Style panel pick: the pick runs on a stand-in tab wearing the look (so a theme, a look or a
// pattern lands exactly as on a tab), then the Overview's settings are read back, through the one normaliser.
export function withOverviewChange(look: OverviewStyle, change: (tab: Tab) => Tab): OverviewStyle {
  const stand: Tab = { id: 'overview', name: 'Overview', elements: [], ...look };
  return readOverviewStyle(pickStyle(change(stand))) ?? {};
}

// Text size: Small, Medium or Large scale the page's text; an exact px reads as the nearest of the three.
const TEXT_SCALE = { sm: 0.9, md: 1, lg: 1.125 } as const;
export function overviewTextScale(size: TextSize | undefined): number {
  if (typeof size === 'number') return size <= 12 ? TEXT_SCALE.sm : size >= 18 ? TEXT_SCALE.lg : 1;
  return size === 'sm' || size === 'lg' ? TEXT_SCALE[size] : 1;
}

// Tailwind's type steps the page uses, in rem: scaled together on the page's root so every class keeps its rhythm.
const TYPE_STEPS = {
  '--text-xs': 0.75,
  '--text-sm': 0.875,
  '--text-base': 1,
  '--text-lg': 1.125,
  '--text-xl': 1.25,
  '--text-2xl': 1.5,
  '--text-3xl': 1.875,
} as const;

export type OverviewSurface = {
  // The app's light or dark colour pairs the page takes: the pair that matches its backdrop.
  scheme: Appearance;
  style: CSSProperties;
  // The header's colours as custom properties (overview-header-paint.ts): its theme's board header.
  header: CSSProperties;
};

// Below this strength the backdrop is mostly the app's own surface, so the page keeps the viewer's scheme.
const SCHEME_FROM_OPACITY = 0.5;

// The page as the look draws it in the viewer's appearance: its backdrop (colour and a still pattern, laid opaque on
// the app's surface), the scheme matching it, its font and its type scale.
export function overviewSurfaceOf(look: OverviewStyle, appearance: Appearance): OverviewSurface {
  const backdrop = resolveViewBackdrop(look, appearance);
  const opacity = backdrop.backgroundOpacity ?? 1;
  const scheme: Appearance =
    opacity < SCHEME_FROM_OPACITY
      ? appearance
      : isDarkCanvas(backdrop.backgroundColor)
        ? 'dark'
        : 'light';
  const surface = scheme === 'dark' ? 'var(--color-slate-950)' : 'var(--color-slate-50)';
  const style: CSSProperties = {
    ...tabBackgroundStyle(
      backdrop.backgroundPattern ?? 'grid',
      { x: 0, y: 0 },
      backdrop.backgroundColor,
      backdrop.patternColor,
      opacity,
      look.backgroundPatternScale ?? 1,
    ),
    // Opaque: the backdrop's colour at its strength over the app's surface, so nothing under the page shows.
    backgroundColor: `color-mix(in srgb, ${backdrop.backgroundColor} ${Math.round(opacity * 100)}%, ${surface})`,
  };
  const font = resolveFontStack(look.font);
  if (font) style.fontFamily = font;
  const scale = overviewTextScale(look.defaultTextSize);
  if (scale !== 1) {
    const vars = style as Record<string, string>;
    for (const [name, rem] of Object.entries(TYPE_STEPS)) vars[name] = `${rem * scale}rem`;
  }
  const header = overviewHeaderVars(overviewHeaderPaint(getTheme(look.theme, appearance), scheme));
  return { scheme, style, header };
}
