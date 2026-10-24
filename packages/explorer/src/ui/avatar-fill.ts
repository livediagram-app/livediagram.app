// A person's colour as an avatar's fill under white initials (the inbox's discs, the share dialog's "Sharing as"). A
// presence colour is a Tailwind 500 step, and white on most of them falls below WCAG AA (white on orange #f97316 is
// 2.8:1), so the disc wears the same colour darkened, toward black in its own hue, just far enough for 4.5:1.

/** WCAG AA for the initials, small bold text. */
export const AVATAR_TEXT_CONTRAST = 4.5;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function channels(color: string): [number, number, number] | null {
  const m = HEX.exec(color.trim());
  if (!m) return null;
  const hex = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** White text's contrast ratio on a fill. */
export function whiteContrast([r, g, b]: readonly [number, number, number]): number {
  const lum = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return 1.05 / (lum + 0.05);
}

const toHex = (rgb: readonly number[]) =>
  `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

// The palette has ten colours and a page shows a handful of people: a few entries, bounded all the same.
const cache = new Map<string, string | null>();
const CACHE_MAX = 64;

/**
 * The fill for an avatar with white initials: the colour itself when white already reads on it, else the same hue
 * darkened in 5% steps until it does. Null for a colour that isn't #rgb or #rrggbb, so the disc keeps its own fill.
 */
export function avatarFill(color: string): string | null {
  const known = cache.get(color);
  if (known !== undefined) return known;
  const rgb = channels(color);
  let fill: string | null = null;
  if (rgb) {
    let t = 0;
    let shaded = rgb;
    while (whiteContrast(shaded) < AVATAR_TEXT_CONTRAST && t < 1) {
      t = Math.min(1, t + 0.05);
      shaded = rgb.map((c) => Math.round(c * (1 - t))) as unknown as [number, number, number];
    }
    fill = t === 0 ? color.trim().toLowerCase() : toHex(shaded);
  }
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(color, fill);
  return fill;
}
