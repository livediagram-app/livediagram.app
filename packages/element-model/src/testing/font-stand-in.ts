// A real-font stand-in for tests (Work Tracker 910): a 2D context whose widths depend on the font the caller set, its
// weight and size, and on the letter (narrow i, l and I, wide m and w), as a real face's do. The estimate the measures
// fall back to without a canvas ignores all three, so a test on it passes even when two measures disagree; this one
// tells them apart.

// A weight's share of the font size an average letter takes.
const EM_AT_WEIGHT: Readonly<Record<number, number>> = {
  400: 0.52,
  500: 0.57,
  600: 0.61,
  700: 0.64,
};
const NARROW = new Set(['i', 'l', 'I', 'j', 't', 'f', '.', ',', ' ']);
const WIDE = new Set(['m', 'w', 'M', 'W']);

/** The width `text` takes in `font` (`<weight> [italic ]<size>px <family>`), as the stand-in measures it. */
export function standInWidth(font: string, text: string): number {
  const match = /^(\d{3}) (?:italic )?(\d+(?:\.\d+)?)px/.exec(font);
  const weight = match ? Number(match[1]) : 400;
  const size = match ? Number(match[2]) : 16;
  const em = EM_AT_WEIGHT[weight] ?? EM_AT_WEIGHT[400]!;
  let width = 0;
  for (const ch of text) width += size * em * (NARROW.has(ch) ? 0.5 : WIDE.has(ch) ? 1.4 : 1);
  return width;
}

/** A stand-in 2D context: `font` as set, `measureText` by standInWidth. */
export function standInContext(): { font: string; measureText: (s: string) => { width: number } } {
  const ctx = {
    font: '400 16px system-ui',
    measureText: (s: string) => ({ width: standInWidth(ctx.font, s) }),
  };
  return ctx;
}

/** A `document` whose canvases measure with the stand-in, and a `getComputedStyle` naming a family, for a test to
 *  stub onto globalThis (vi.stubGlobal) in a Node environment. */
export function standInBrowser(): {
  document: { body: object; createElement: (tag: string) => { getContext: () => unknown } };
  getComputedStyle: () => { fontFamily: string };
} {
  const ctx = standInContext();
  return {
    document: { body: {}, createElement: () => ({ getContext: () => ctx }) },
    getComputedStyle: () => ({ fontFamily: 'Stand-in Sans' }),
  };
}
