// Hue, saturation and value for the custom colour picker's square and slider
// (docs/specs/023-whiteboard/whiteboard.md "The colour picker"): the square is saturation (x) by
// brightness (y) at the slider's hue. Hue in degrees 0 to 360, saturation and value 0 to 1.

export type Hsv = { h: number; s: number; v: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function hsvToHex({ h, s, v }: Hsv): string {
  const sat = clamp01(s);
  const val = clamp01(v);
  const f = (n: number) => {
    const k = (n + (((h % 360) + 360) % 360) / 60) % 6;
    return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return (
    '#' +
    [f(5), f(3), f(1)]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** The hue, saturation and value of a `#rrggbb`; null for anything else. */
export function hexToHsv(hex: string): Hsv | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
