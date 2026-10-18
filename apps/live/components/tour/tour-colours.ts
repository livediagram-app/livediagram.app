// A tour's card in the active tab's colours (docs/specs/007-editor/editor-tour.md "Look"): the start panels' palette
// (useStartPalette) as the CSS variables TourPopover and TourStage paint from, so every tour (Diagram, Plan,
// Workshop, Draw, Pages, the card type tour) reads as part of the tab it runs on. Pure.
import type { CSSProperties } from 'react';
import { contrastRatio, isLightColor, mixHex, type PlanPalette } from '@livediagram/document';

const LIGHT_INK = '#ffffff';
const DARK_INK = '#0f172a';

// The ink on the accent (the primary buttons): white or a near-black, whichever reads better on it.
export function inkOn(accent: string): string {
  const light = contrastRatio(LIGHT_INK, accent);
  const dark = contrastRatio(DARK_INK, accent);
  if (Number.isNaN(light) || Number.isNaN(dark)) return isLightColor(accent) ? DARK_INK : LIGHT_INK;
  return light >= dark ? LIGHT_INK : DARK_INK;
}

// WCAG AA for the button labels (docs/specs/004-interface-design/color-scheme.md).
const LABEL_CONTRAST_MIN = 4.5;

// The accent as a label on a white button (the banner's primary button): the accent itself where it reads there, else
// deepened toward the dark ink until it does. A dark tab's accent is light (a pale blue on a slate canvas), and as it
// was it drew the banner's Yes at 2.5:1.
export function accentOnWhite(accent: string): string {
  for (let step = 0; step <= 10; step++) {
    const label = step === 0 ? accent : mixHex(accent, DARK_INK, 1 - step / 10);
    const ratio = contrastRatio(label, LIGHT_INK);
    if (Number.isNaN(ratio)) return DARK_INK;
    if (ratio >= LABEL_CONTRAST_MIN) return label;
  }
  return DARK_INK;
}

// The variables: --tour-card, --tour-border, --tour-text, --tour-muted, --tour-accent, --tour-on-accent,
// --tour-accent-on-white (the banner's white button's label) and --tour-hover (a faint wash of the accent for the quiet
// buttons).
export function tourColourVars(palette: PlanPalette): CSSProperties {
  return {
    '--tour-card': palette.card,
    '--tour-border': palette.border,
    '--tour-text': palette.text,
    '--tour-muted': palette.muted,
    '--tour-accent': palette.focus,
    '--tour-on-accent': inkOn(palette.focus),
    '--tour-accent-on-white': accentOnWhite(palette.focus),
    '--tour-hover': `color-mix(in srgb, ${palette.focus} 10%, transparent)`,
  } as CSSProperties;
}
