// Right-to-left text in exported labels (docs/specs/008-canvas/canvas-and-palette.md "Labels"). An SVG <text> has one
// direction for all its lines, and the editor's per-line rule (`unicode-bidi: plaintext`) has no SVG twin, so a line
// holding right-to-left letters is wrapped in a First Strong Isolate (U+2068 ... U+2069): the line takes its direction
// from its first letter, as on the canvas, and sits in the <text> as one unit, so its alignment is unchanged. A line
// without right-to-left letters is left exactly as it was.

// Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic and their presentation forms.
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

const FSI = '\u2068';
const PDI = '\u2069';

/** True when the text holds a right-to-left letter. */
export const hasRtl = (text: string): boolean => RTL.test(text);

/** The line, isolated with its own first-strong direction when it holds right-to-left letters. */
export const bidiLine = (text: string): string => (hasRtl(text) ? `${FSI}${text}${PDI}` : text);

/** Already-built SVG for one line (its runs' <tspan>s), isolated as bidiLine does, when `plain` holds right-to-left
 *  letters. The marks sit between the runs, so each run keeps its own style. */
export const bidiMarkup = (markup: string, plain: string): string =>
  hasRtl(plain) ? `${FSI}${markup}${PDI}` : markup;
