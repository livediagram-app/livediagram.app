import { contrastRatio, hexToRgb, rgbToHex } from '@liveworkspace/brand/colour';

// The badge beside a Start With card's name (the Community badge on a Community tile; liveworkspace/docs/specs/
// 007-community/community.md "Start With"): the panel's accent on a soft tint of itself, over the card's surface. The
// accent alone on its tint read under WCAG AA for the badge's 10px text in light (livediagram's sky 3.3:1, livehuddle's
// emerald 4.3:1, liveplanner's violet 4.4:1), and a tab's own theme can lower it further, so the ink is the accent
// deepened (or, on a dark surface, lifted) a step at a time until it reads at AA on the tint as drawn, keeping its hue.

/** How strongly the badge is tinted with the accent, in percent. */
export const COMMUNITY_START_BADGE_TINT = 14;

// The badge's text reaches this contrast on its tint (WCAG AA for body text).
const BADGE_CONTRAST = 4.5;
// How far the ink moves toward black or white each step while it reads under BADGE_CONTRAST.
const INK_STEP = 0.04;
const HEX = /^#[0-9a-f]{6}$/i;

// `a` laid over `b` at `share` (0 to 1), as `color-mix(in srgb, a share%, b)` draws it; both `#rrggbb`.
function mix(a: string, b: string, share: number): string {
  const x = hexToRgb(a)!;
  const y = hexToRgb(b)!;
  const at = (p: number, q: number) => p * share + q * (1 - share);
  return rgbToHex({ r: at(x.r, y.r), g: at(x.g, y.g), b: at(x.b, y.b) });
}

// `ink` moved toward black (on a light `behind`) or white (on a dark one) until it reads at BADGE_CONTRAST.
function readableOn(ink: string, behind: string): string {
  if (contrastRatio(ink, behind) >= BADGE_CONTRAST) return ink;
  const toward =
    contrastRatio(behind, '#000000') > contrastRatio(behind, '#ffffff') ? '#000000' : '#ffffff';
  for (let share = INK_STEP; share < 1; share += INK_STEP) {
    const next = mix(toward, ink, share);
    if (contrastRatio(next, behind) >= BADGE_CONTRAST) return next;
  }
  return toward;
}

/**
 * A Start With card's badge colours: the tint (`accent` at `tint` percent, COMMUNITY_START_BADGE_TINT unless told,
 * over the card's `surface`) and an ink that reads on it at AA. Colours other than `#rrggbb` keep the plain look (the
 * tint over whatever is behind, the accent as ink), since there is nothing to measure.
 */
export function communityStartBadgeStyle(
  accent: string,
  surface: string,
  tint: number = COMMUNITY_START_BADGE_TINT,
): { backgroundColor: string; color: string } {
  if (!HEX.test(accent) || !HEX.test(surface))
    return {
      backgroundColor: `color-mix(in srgb, ${accent} ${tint}%, transparent)`,
      color: accent,
    };
  const backgroundColor = mix(accent, surface, tint / 100);
  return { backgroundColor, color: readableOn(accent, backgroundColor) };
}
