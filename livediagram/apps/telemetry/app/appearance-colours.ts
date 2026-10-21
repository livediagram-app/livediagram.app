import type { Appearance } from '@livediagram/ui';
import { contrastRatio, shade } from './colour-maths';

// The chart hues in dark (docs/specs/017-telemetry/telemetry.md): the category colours are picked
// for a white card, and the deep ones (Page's crimson, Timeline's deep sky) sink into the dark one.
// In dark each hue is mixed toward white just far enough to read at text contrast on the card, so
// it stays its own hue and the bright ones stay exactly as they are.

// The Steel slate-900 token (packages/tailwind-config/theme.css), the card every chart sits on.
export const DARK_CARD = '#131b26';
// WCAG 2.2 AA for body text: the cloud's words are text, and the lines and icons (3:1) clear it too.
export const DARK_MIN_CONTRAST = 4.5;
// How far a hue may darken before it is too dim: the deepest shade stackMemberColors starts from.
const DARKEST = -0.4;
const STEP = 0.01;

const floors = new Map<string, number>();

// The least mix (toward black when negative, white when positive, no lower than DARKEST) at which
// `hex` reads at DARK_MIN_CONTRAST on the dark card. Lightening only raises contrast on a dark
// card, so the first step that clears it is the floor.
export function darkFloor(hex: string): number {
  const known = floors.get(hex);
  if (known !== undefined) return known;
  let t = DARKEST;
  while (t < 1 && contrastRatio(shade(hex, t), DARK_CARD) < DARK_MIN_CONTRAST) {
    t = Math.round((t + STEP) * 100) / 100;
  }
  floors.set(hex, t);
  return t;
}

// A chart hue as painted: unchanged in light, lifted only as far as it must be in dark.
export function forAppearance(hex: string, appearance: Appearance): string {
  if (appearance === 'light') return hex;
  const t = darkFloor(hex);
  return t > 0 ? shade(hex, t) : hex;
}
