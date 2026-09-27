// A runtime colour under white text (avatar initials, cursor and presence labels, a participant's or
// team's colour) in dark mode (docs/specs/004-interface-design/color-scheme.md, Dark palette rules).
// White falls below AA on every participant colour, so dark mode paints a deeper shade of the same
// hue and keeps the white text. Light mode keeps the colour exactly (#74's light half).
import type { CSSProperties } from 'react';
import { contrastRatio, shade } from '@livediagram/diagram';

// Each participant colour's own Tailwind 700 step: the operator-chosen dark treatment.
const PARTICIPANT_DEEP: Record<string, string> = {
  '#0ea5e9': '#0369a1', // sky
  '#10b981': '#047857', // emerald
  '#f59e0b': '#b45309', // amber
  '#ef4444': '#b91c1c', // red
  '#8b5cf6': '#6d28d9', // violet
  '#ec4899': '#be185d', // pink
  '#14b8a6': '#0f766e', // teal
  '#f97316': '#c2410c', // orange
  '#6366f1': '#4338ca', // indigo
  '#84cc16': '#4d7c0f', // lime
};

const AA = 4.5;
const SHADE_STEP = 0.05;

/** The dark-mode shade of an identity colour: deep enough for white text at AA. */
export function identityDeep(color: string): string {
  const known = PARTICIPANT_DEEP[color.toLowerCase()];
  if (known) return known;
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  // Any other colour (a custom one, a team's): darken in small steps until white reads.
  for (let amount = 0; amount < 1; amount += SHADE_STEP) {
    const candidate = amount === 0 ? color : shade(color, amount);
    if (contrastRatio('#ffffff', candidate) >= AA) return candidate;
  }
  return '#000000';
}

/** Paint an element's background from both shades; the element carries IDENTITY_FILL. */
export function identityVars(color: string): CSSProperties {
  return { '--identity': color, '--identity-deep': identityDeep(color) } as CSSProperties;
}

export const IDENTITY_FILL = 'bg-(--identity) dark:bg-(--identity-deep)';
