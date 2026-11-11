// A box sized to its label (livediagram/docs/specs/015-api/mcp-server.md §4.7 "Boxes fit their labels"): what an
// agent's `add` sizes a new box with. It outlived the graph input it was written for
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3).

import { SHAPE_DEFAULT_SIZE } from './factories';
import type { ShapeKind } from './shape-kind';

// A box that fits its label (livediagram/docs/specs/015-api/mcp-server.md §4.7 "Boxes fit their labels"): the
// shape's default size at least, widened to the label's estimated one-line
// width up to a cap, then taller by a line for each wrap past it. An estimate
// (no DOM here), tuned to the default label face at its default size; the
// layout's peer sizing then gives a whole tier the size its longest label
// needs.
const CHAR_PX = 7.4;
// Capitals set about 30% wider than the average glyph CHAR_PX assumes, so an
// all-caps name ("TEAM_MEMBER", an ER table) was sized short and wrapped
// mid-word. Text length in average-glyph units.
const CAPS_WIDTH = 1.3;
// How wide `text` sets at `px`, estimated (no DOM here): what a header measures its caption with.
export const glyphWidth = (text: string, px: number) => glyphUnits(text) * px * GLYPH_EM;
const glyphUnits = (text: string) =>
  [...text].reduce((sum, ch) => sum + (ch >= 'A' && ch <= 'Z' ? CAPS_WIDTH : 1), 0);
const LINE_PX = 19;
const PAD_PX = 40;
const MAX_BOX_W = 240;

// The template look graph input wears (livediagram/docs/specs/015-api/mcp-server.md §4.7 "The graph look"): boxes at the
// flowchart template's proportions, never the palette's 120×120 square, and one text size for every node, picked by
// the caller from how many nodes there are. The editor's own Mermaid import keeps the plain sizing.
// `fontPx` measures at a box's own label size in place of the look's (a box an edit adds at its own text size).
export type GraphLook = { textSize: 'sm' | 'md'; fontPx?: number };

// The widest a box grows before its label wraps, per text size: about eighteen characters a line.
const LOOK_MAX_W: Readonly<Record<GraphLook['textSize'], number>> = { sm: 240, md: 300 };
// Average glyph width and line height as fractions of the font size (Inter at its label weight); CHAR_PX below is
// this at 14px.
const GLYPH_EM = 0.53;
const LINE_EM = 1.35;
const LOOK_FONT_PX: Readonly<Record<GraphLook['textSize'], number>> = { sm: 14, md: 22 };

export function labelBoxSize(
  label: string | undefined,
  shape: ShapeKind,
  look?: GraphLook,
  hasIcon = false,
  // In the look, the smallest box in place of the kind's: a box joining siblings starts at their size.
  floor?: { width: number; height: number },
): { width: number; height: number } {
  if (look) return lookBoxSize(label, shape, look, hasIcon, floor);
  const base = SHAPE_DEFAULT_SIZE[shape];
  const text = (label ?? '').trim();
  if (!text) return { width: base.width, height: base.height };
  // Line by line, as the look measures: the widest line sets the width, and each wraps on its own.
  const lineW = text.split('\n').map((l) => glyphUnits(l) * CHAR_PX);
  const width = Math.round(Math.min(MAX_BOX_W, Math.max(base.width, Math.max(...lineW) + PAD_PX)));
  const lines = lineW.reduce((n, w) => n + Math.max(1, Math.ceil(w / (width - PAD_PX))), 0);
  const height = Math.round(Math.max(base.height, lines * LINE_PX + 28));
  return { width, height };
}

// A box in the template look: the kind's floor (its palette size, or the siblings' it joins), wider for a longer
// label up to the cap, then taller by a line for each wrap.
function lookBoxSize(
  label: string | undefined,
  kind: ShapeKind,
  look: GraphLook,
  hasIcon: boolean,
  given?: { width: number; height: number },
): { width: number; height: number } {
  const floor = given ?? SHAPE_DEFAULT_SIZE[kind];
  const text = (label ?? '').trim();
  if (!text) return { ...floor };
  const px = look.fontPx ?? LOOK_FONT_PX[look.textSize];
  // The wrap width grows with a larger font, so a line holds as many words.
  const maxW = LOOK_MAX_W[look.textSize] * Math.max(1, px / LOOK_FONT_PX[look.textSize]);
  // An inline icon beside the label takes its glyph and gap (inlineIconMetrics: about 1.6 × the font, a third
  // of that again between).
  const iconRoom = hasIcon ? Math.round(px * 1.6 * 1.32) : 0;
  // A label written over several lines is measured line by line: its widest line sets the width, and each wraps on its own.
  const lineW = text.split('\n').map((l) => glyphUnits(l) * px * GLYPH_EM);
  const textW = Math.max(...lineW) + iconRoom;
  const pad = 48;
  const width = Math.round(Math.min(maxW, Math.max(floor.width, textW + pad)));
  const lines = lineW.reduce(
    (n, w, i) => n + Math.max(1, Math.ceil((w + (i === 0 ? iconRoom : 0)) / (width - pad))),
    0,
  );
  const textH = lines * px * LINE_EM + 28;
  // A box joining siblings keeps their height while it holds the one line with room above and below.
  const siblingHolds = !!given && lines === 1 && given.height >= px * LINE_EM + 16;
  const height = siblingHolds ? given.height : Math.round(Math.max(floor.height, textH));
  return { width, height };
}
