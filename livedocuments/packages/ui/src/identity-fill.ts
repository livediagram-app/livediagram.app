// A runtime colour under white text (avatar initials, cursor and presence labels, a participant's or
// team's colour) in dark mode (docs/specs/004-interface-design/color-scheme.md, Dark palette rules).
// White falls below AA on every participant colour, so dark mode paints a deeper shade of the same
// hue and keeps the white text. Light mode keeps the colour exactly.
import type { CSSProperties } from 'react';
import { contrastRatio, shade } from '@livedocuments/document';
import { presenceColour } from '@liveworkspace/settings';

const AA = 4.5;
const SHADE_STEP = 0.05;

/** The dark-mode shade of an identity colour: deep enough for white text at AA. */
export function identityDeep(color: string): string {
  // A presence palette colour has its own deep shade, the operator-chosen dark treatment.
  const known = presenceColour(color)?.deep;
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
