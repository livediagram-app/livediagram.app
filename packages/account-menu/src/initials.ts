import { isSafeColourValue } from '@liveworkspace/auth-client/account-name';
import { initialsOf } from '@liveworkspace/model-core/names';
import {
  automaticPresenceColour,
  presenceColour,
  type PresenceColour,
} from '@liveworkspace/settings/presence';

// A person's initials, for their avatar: the shared rule every app's avatars use (@liveworkspace/model-core
// initialsOf), always two letters where the name has them, the first letters of their first and last names, or the
// first two of the one name they gave, punctuation and symbols skipped. An email reads as its local part's words.
export function initials(name: string, fallback?: string | null): string {
  return initialsOf(name, fallback);
}

// The avatar's colour for Automatic: the one shared rule (@liveworkspace/settings/presence automaticPresenceColour),
// picked from the name, so the same person has the same disc, cursor and author dot in every app.
export function avatarColour(name: string): PresenceColour {
  return automaticPresenceColour(name);
}

// White on a colour reads at AA from this contrast up.
const AA = 4.5;

// A #rgb or #rrggbb colour's contrast with white; null for any other syntax.
function whiteContrast(colour: string): number | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r! + 0.7152 * g! + 0.0722 * b! + 0.05);
}

// The avatar's fill under white initials (liveworkspace/docs/specs/010-site/site.md "The header"): the person's own presence colour
// when they chose one, else the colour picked from the name. A palette colour paints in its deep shade; a custom one
// as it is when white already reads on it, else mixed with black in OKLab. Mixing with black at 55% scales every
// linear RGB channel by 0.55³ ≈ 0.166, so even white comes out at 4.86:1, whatever syntax the colour is in. A colour
// that isn't safe to paint into CSS is ignored.
export function avatarFill(name: string, colour?: string | null): string {
  if (!isSafeColourValue(colour)) return avatarColour(name).deep;
  const known = presenceColour(colour);
  if (known) return known.deep;
  const contrast = whiteContrast(colour);
  if (contrast !== null && contrast >= AA) return colour;
  return `color-mix(in oklab, ${colour} 55%, black)`;
}
