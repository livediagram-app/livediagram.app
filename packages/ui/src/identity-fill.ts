// A runtime colour under text (avatar initials, cursor and presence labels, a participant's or team's colour), in
// both appearances (docs/specs/004-interface-design/color-scheme.md in each product, Dark palette rules). Light mode
// keeps the colour exactly; dark mode paints a deeper shade of the same hue. On each, the text is white where white
// reaches AA, and otherwise the dark ink: white falls below AA on every participant colour as it is, so light mode's
// initials are dark, while every deep shade keeps white. Each product binds it once to its model package's colour
// maths (its identity-fill.ts).
import type { CSSProperties } from 'react';
import { presenceColour } from '@liveworkspace/settings/presence';

const AA = 4.5;
const SHADE_STEP = 0.05;

// The dark ink: slate-950, which reaches AA on every participant colour (4.5:1 on indigo, the darkest).
export const IDENTITY_DARK_INK = '#020617';
const WHITE = '#ffffff';

// The fill and its ink in each appearance. The ink is important, so it wins over a caller's own `text-white`, and
// falls back to white where a caller set the fill's custom properties without the inks.
export const IDENTITY_FILL =
  'bg-(--identity) text-[color:var(--identity-ink,#fff)]! dark:bg-(--identity-deep) dark:text-[color:var(--identity-deep-ink,#fff)]!';

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

  /** The text on a fill: white where it reaches AA, else the dark ink. White for a colour it cannot read. */
  function identityInk(fill: string): string {
    if (!/^#[0-9a-f]{6}$/i.test(fill)) return WHITE;
    return contrastRatio(WHITE, fill) >= AA ? WHITE : IDENTITY_DARK_INK;
  }

  /** Paint an element's background and text from both shades; the element carries IDENTITY_FILL. */
  function identityVars(color: string): CSSProperties {
    const deep = identityDeep(color);
    return {
      '--identity': color,
      '--identity-ink': identityInk(color),
      '--identity-deep': deep,
      '--identity-deep-ink': identityInk(deep),
    } as CSSProperties;
  }

  return { identityDeep, identityInk, identityVars };
}
