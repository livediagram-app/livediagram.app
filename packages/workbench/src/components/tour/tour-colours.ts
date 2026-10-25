// A tour's card in the active tab's colours (docs/specs/007-editor/editor-tour.md "Look"): the start panels' palette
// (each editor's useStartPalette) as the CSS variables TourPopover and TourStage paint from, so every tour reads as
// part of the tab it runs on. Pure.
import type { CSSProperties } from 'react';
import { contrastRatio } from '@liveworkspace/brand/colour';

const LIGHT_INK = '#ffffff';
const DARK_INK = '#0f172a';

// The palette colours a tour's card is painted in: its surface, border, ink, muted ink and accent.
export type TourPalette = {
  card: string;
  border: string;
  text: string;
  muted: string;
  focus: string;
};

// The ink on the accent (the primary buttons): white or a near-black, whichever reads better on it. An accent that
// cannot be read as hex takes the near-black, as a light colour would.
export function inkOn(accent: string): string {
  const light = contrastRatio(LIGHT_INK, accent);
  const dark = contrastRatio(DARK_INK, accent);
  if (Number.isNaN(light) || Number.isNaN(dark)) return DARK_INK;
  return light >= dark ? LIGHT_INK : DARK_INK;
}

// The variables: --tour-card, --tour-border, --tour-text, --tour-muted, --tour-accent, --tour-on-accent and
// --tour-hover (a faint wash of the accent for the quiet buttons).
export function tourColourVars(palette: TourPalette): CSSProperties {
  return {
    '--tour-card': palette.card,
    '--tour-border': palette.border,
    '--tour-text': palette.text,
    '--tour-muted': palette.muted,
    '--tour-accent': palette.focus,
    '--tour-on-accent': inkOn(palette.focus),
    '--tour-hover': `color-mix(in srgb, ${palette.focus} 10%, transparent)`,
  } as CSSProperties;
}
