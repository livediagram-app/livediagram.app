'use client';

// Make the editor chrome follow the ACTIVE TAB's theme (spec/42), two ways:
//   1. The brand-* accent (buttons, rings, focus) is retargeted to the theme's
//      accent — in BOTH light and dark mode.
//   2. In DARK mode, the neutral slate surfaces (panels, borders, deep
//      backgrounds) become a darker, muted version of the theme hue instead of
//      cold slate — so dark mode reads as a dark version of the chosen theme,
//      not plain black.
//
// Both palettes are Tailwind v4 CSS variables (--color-brand-*, --color-slate-*),
// so we just retarget those variables. We inject ONE <style> element rather than
// inline styles so the slate override can be scoped to `.dark` (CSS handles the
// mode switch — no JS mode detection) and so body-portaled UI (menus, dialogs,
// popovers, toasts) inherits both. It's removed on unmount / when the tab is
// unthemed, so the default light-blue brand + cold-slate dark stand elsewhere.

import { useEffect } from 'react';
import { isLightColor, shade, tint } from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';

const STYLE_ID = 'lvd-editor-accent';
const BRAND_STOPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const;
// Only the slate stops used as dark-mode SURFACES (panels / borders / deep
// backgrounds). Lighter stops (50..500) stay neutral so dark-mode TEXT, which
// uses them, keeps its readable greys.
const DARK_SURFACE_STOPS = ['600', '700', '800', '900', '950'] as const;

// Blend two #rrggbb hexes; t=0 -> a, t=1 -> b.
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const av = (pa >> shift) & 255;
    const bv = (pb >> shift) & 255;
    return Math.round(av + (bv - av) * t);
  };
  return '#' + [ch(16), ch(8), ch(0)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

// Spin a single theme accent into an 11-stop brand ramp anchored at 600. A pale
// accent (dark-theme strokes are light) is darkened first so white-on-600 keeps
// contrast.
function brandScale(accent: string): Record<(typeof BRAND_STOPS)[number], string> {
  const base = isLightColor(accent) ? shade(accent, 0.4) : accent;
  return {
    '50': tint(base, 0.92),
    '100': tint(base, 0.84),
    '200': tint(base, 0.7),
    '300': tint(base, 0.52),
    '400': tint(base, 0.3),
    '500': tint(base, 0.13),
    '600': base,
    '700': shade(base, 0.18),
    '800': shade(base, 0.34),
    '900': shade(base, 0.48),
    '950': shade(base, 0.6),
  };
}

// Dark-mode surface ramp: pull the accent toward neutral slate (so it's a muted
// tint, not a garish saturated dark) then shade it down. Keeps dark mode dark
// while carrying the theme's hue.
function darkSurfaceScale(accent: string): Record<(typeof DARK_SURFACE_STOPS)[number], string> {
  const muted = mixHex(accent, '#64748b', 0.6); // slate-500 as the neutral anchor
  return {
    '600': shade(muted, 0.42),
    '700': shade(muted, 0.56),
    '800': shade(muted, 0.7),
    '900': shade(muted, 0.8),
    '950': shade(muted, 0.88),
  };
}

export function useEditorAccent(themeId: string | undefined): void {
  // The "brand"/Default colour scheme (and an unthemed tab) has no accent stroke,
  // so we leave the built-in light-blue brand + cold-slate dark in place.
  const accent = (themeId ? getTheme(themeId) : null)?.elementStroke ?? null;

  useEffect(() => {
    if (!accent) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }
    const brand = brandScale(accent);
    const dark = darkSurfaceScale(accent);
    const brandVars = BRAND_STOPS.map((s) => `--color-brand-${s}:${brand[s]};`).join('');
    const slateVars = DARK_SURFACE_STOPS.map((s) => `--color-slate-${s}:${dark[s]};`).join('');
    const css = `:root{${brandVars}}.dark{${slateVars}}`;

    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [accent]);
}
