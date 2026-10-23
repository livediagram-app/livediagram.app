// A tour's card in the active tab's colours (docs/specs/007-editor/editor-tour.md "Look"): the start panels' palette
// (useStartPalette) as the CSS variables TourPopover and TourStage paint from, so every tour (Diagram,
// Workshop, Draw) reads as part of the tab it runs on. Pure.
import type { StartPalette } from '@/components/start/start-palette';
import type { CSSProperties } from 'react';
import { contrastRatio, isLightColor, toneToContrast } from '@livediagram/document';

const LIGHT_INK = '#ffffff';
const DARK_INK = '#0f172a';

// The ink on the accent (the primary buttons): white or a near-black, whichever reads better on it.
export function inkOn(accent: string): string {
  const light = contrastRatio(LIGHT_INK, accent);
  const dark = contrastRatio(DARK_INK, accent);
  if (Number.isNaN(light) || Number.isNaN(dark)) return isLightColor(accent) ? DARK_INK : LIGHT_INK;
  return light >= dark ? LIGHT_INK : DARK_INK;
}

// The banners' surface (the offer and the last card, TourBanner): the sign-in banner's deep gradient in the tab's own
// hue, always in white ink. The accent is kept to its hue and saturation and deepened until white reads on it at
// BANNER_FROM_CONTRAST, so the copy, at 90% white, still clears WCAG AA's 4.5:1 (5.1:1 at the floor); the far end of
// the gradient goes deeper, to BANNER_TO_CONTRAST. As sign-in's brand-700 to brand-800 (5.9:1 and 7.6:1,
// docs/specs/004-interface-design/color-scheme.md). A dark tab's accent is pale, and as it was painted the banner a
// washed-out blue with its words in navy at under 3:1.
export const BANNER_INK = LIGHT_INK;
export const BANNER_FROM_CONTRAST = 5.9;
export const BANNER_TO_CONTRAST = 7.6;
// Sign-in's own gradient (brand-700, brand-800), for an accent that cannot be read as hex.
const SIGN_IN_BANNER_FROM = '#0369a1';
const SIGN_IN_BANNER_TO = '#075985';

export function bannerColours(accent: string): { from: string; to: string } {
  const from = toneToContrast(accent, BANNER_INK, 'light', BANNER_FROM_CONTRAST);
  const to = toneToContrast(from, BANNER_INK, 'light', BANNER_TO_CONTRAST);
  // An accent that cannot be read as hex comes back as it was: fall back to sign-in's own brand gradient.
  if (!(contrastRatio(from, BANNER_INK) >= BANNER_FROM_CONTRAST))
    return { from: SIGN_IN_BANNER_FROM, to: SIGN_IN_BANNER_TO };
  return { from, to };
}

// The variables: --tour-card, --tour-border, --tour-text, --tour-muted, --tour-accent, --tour-on-accent,
// --tour-banner-from and --tour-banner-to (the banners' gradient, whose deep end is also the label on their white
// button) and --tour-hover (a faint wash of the accent for the quiet buttons).
export function tourColourVars(palette: StartPalette): CSSProperties {
  const banner = bannerColours(palette.focus);
  return {
    '--tour-card': palette.card,
    '--tour-border': palette.border,
    '--tour-text': palette.text,
    '--tour-muted': palette.muted,
    '--tour-accent': palette.focus,
    '--tour-on-accent': inkOn(palette.focus),
    '--tour-banner-from': banner.from,
    '--tour-banner-to': banner.to,
    '--tour-hover': `color-mix(in srgb, ${palette.focus} 10%, transparent)`,
  } as CSSProperties;
}
