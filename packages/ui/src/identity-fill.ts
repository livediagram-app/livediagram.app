// A runtime colour under white text (avatar initials, cursor and presence labels, a participant's or
// team's colour) in dark mode (docs/specs/004-interface-design/color-scheme.md in each product, Dark palette
// rules). White falls below AA on every participant colour, so dark mode paints a deeper shade of the same
// hue and keeps the white text. Light mode keeps the colour exactly. Each product binds it once to its
// model package's colour maths (its identity-fill.ts).
import type { CSSProperties } from 'react';
import { presenceColour } from '@liveworkspace/settings/presence';

const AA = 4.5;
const SHADE_STEP = 0.05;

export const IDENTITY_FILL = 'bg-(--identity) dark:bg-(--identity-deep)';

export function createIdentityFill({
  shade,
  contrastRatio,
}: {
  // Darken a #rrggbb colour by `amount` (0 to 1).
  shade: (hex: string, amount: number) => string;
  // The WCAG contrast ratio between two colours.
  contrastRatio: (a: string, b: string) => number;
}) {
  /** The dark-mode shade of an identity colour: deep enough for white text at AA. */
  function identityDeep(color: string): string {
    // A presence palette colour has its own deep shade (its Tailwind 700 step), the operator-chosen dark
    // treatment, the same in every app (@liveworkspace/settings).
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
  function identityVars(color: string): CSSProperties {
    return { '--identity': color, '--identity-deep': identityDeep(color) } as CSSProperties;
  }

  return { identityDeep, identityVars };
}
