// How wide a line of text sets, estimated with no DOM (a header's caption, a chart's labels, a sequence's
// lifeline heads). Capitals set about 30% wider than the average glyph, so an all-caps name is not sized short.
const CAPS_WIDTH = 1.3;
const GLYPH_EM = 0.53;

const glyphUnits = (text: string) =>
  [...text].reduce((sum, ch) => sum + (ch >= 'A' && ch <= 'Z' ? CAPS_WIDTH : 1), 0);

export const glyphWidth = (text: string, px: number) => glyphUnits(text) * px * GLYPH_EM;
