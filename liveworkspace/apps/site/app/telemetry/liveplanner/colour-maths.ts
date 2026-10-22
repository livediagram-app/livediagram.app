// Pure #rrggbb colour maths for the dashboard's chart colours: mixing a hue
// toward white or black, and WCAG contrast between two colours.

const channels = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

// Mix a #rrggbb colour toward white (t > 0) or black (t < 0).
export function shade(hex: string, t: number): string {
  const target = t > 0 ? 255 : 0;
  const amount = Math.abs(t);
  return `#${channels(hex)
    .map((c) =>
      Math.round(c + (target - c) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

// WCAG 2.2 relative luminance.
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

// WCAG 2.2 contrast ratio, 1 to 21, order-free.
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
