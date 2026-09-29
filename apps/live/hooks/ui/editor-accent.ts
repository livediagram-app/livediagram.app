// The CSS a themed tab injects to tint the editor chrome (docs/specs/011-theme/canvas-and-theme-dialog.md),
// as a pure function of the theme's accent. The rules are written `html:root` and `html.dark`,
// one element-type step more specific than the dark palette's `.dark` tokens
// (docs/specs/004-interface-design/color-scheme.md), so the tint wins by selector, not by load order.
import { isLightColor, shade, tint } from '@livediagram/document';

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

export function editorAccentCss(accent: string): string {
  const brand = brandScale(accent);
  const dark = darkSurfaceScale(accent);
  const brandVars = BRAND_STOPS.map((s) => `--color-brand-${s}:${brand[s]};`).join('');
  const slateVars = DARK_SURFACE_STOPS.map((s) => `--color-slate-${s}:${dark[s]};`).join('');
  return `html:root{${brandVars}}html.dark{${slateVars}}`;
}
