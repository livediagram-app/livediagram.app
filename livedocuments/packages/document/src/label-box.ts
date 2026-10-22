// A shape's label and the box it needs (docs/specs/024-agents/blueprints/edit-operations.md "Fields and
// values"): a label capped to a heading, and a box sized to fit a label. Estimates (no DOM here), shared by
// the edit operations and the lint.

import { SHAPE_DEFAULT_SIZE } from './factories';
import { coerceShapeKind } from './validate';

export const GRAPH_LABEL_MAX = 40;

const CHAR_PX = 7.4;
// Capitals set about 30% wider than the average glyph CHAR_PX assumes, so an
// all-caps name ("TEAM_MEMBER") was sized short and wrapped mid-word. Text
// length in average-glyph units.
const CAPS_WIDTH = 1.3;
// How wide `text` sets at `px`, estimated (no DOM here): what a header measures its caption with.
export const glyphWidth = (text: string, px: number) => glyphUnits(text) * px * GLYPH_EM;
const glyphUnits = (text: string) =>
  [...text].reduce((sum, ch) => sum + (ch >= 'A' && ch <= 'Z' ? CAPS_WIDTH : 1), 0);
const LINE_PX = 19;
const PAD_PX = 40;
const MAX_BOX_W = 240;

// The template look (docs/specs/015-api/mcp-server.md §4.7 "The graph look"): boxes at the flowchart
// template's proportions, never the palette's 120×120 square, and one text size for every box.
// `fontPx` measures at a box's own label size in place of the look's (a box an edit adds at its own text size).
export type GraphLook = { textSize: 'sm' | 'md'; fontPx?: number };

// The smallest box per kind in the template look: wide and short like the template's steps. A kind not listed keeps
// its palette size (a device is a device).
const LOOK_FLOOR: Readonly<Partial<Record<string, { width: number; height: number }>>> = {
  square: { width: 180, height: 64 },
  stadium: { width: 180, height: 60 },
  diamond: { width: 180, height: 104 },
  parallelogram: { width: 200, height: 64 },
  hexagon: { width: 180, height: 72 },
  document: { width: 180, height: 80 },
  cylinder: { width: 140, height: 96 },
  cloud: { width: 180, height: 100 },
  trapezoid: { width: 180, height: 72 },
  circle: { width: 96, height: 96 },
};
// The widest a box grows before its label wraps, per text size: about eighteen characters a line.
const LOOK_MAX_W: Readonly<Record<GraphLook['textSize'], number>> = { sm: 240, md: 300 };
// Average glyph width and line height as fractions of the font size (Inter at its label weight); CHAR_PX above is
// this at 14px.
const GLYPH_EM = 0.53;
const LINE_EM = 1.35;
const LOOK_FONT_PX: Readonly<Record<GraphLook['textSize'], number>> = { sm: 14, md: 22 };

// A box that fits its label (docs/specs/015-api/mcp-server.md §4.7 "Boxes fit their labels"): the
// shape's default size at least, widened to the label's estimated one-line
// width up to a cap, then taller by a line for each wrap past it. An estimate
// (no DOM here), tuned to the default label face at its default size. A
// diamond's text only fits its inner half, so it gets more room.
export function labelBoxSize(
  label: string | undefined,
  shape: string,
  look?: GraphLook,
  hasIcon = false,
  // In the look, the smallest box in place of the kind's: a box joining siblings starts at their size.
  floor?: { width: number; height: number },
): { width: number; height: number } {
  if (look) return lookBoxSize(label, coerceShapeKind(shape), look, hasIcon, floor);
  const base = SHAPE_DEFAULT_SIZE[coerceShapeKind(shape)];
  const text = (label ?? '').trim();
  if (!text) return { width: base.width, height: base.height };
  const roomy = shape === 'diamond' ? 1.45 : 1;
  // Line by line, as the look measures: the widest line sets the width, and each wraps on its own.
  const lineW = text.split('\n').map((l) => glyphUnits(l) * CHAR_PX * roomy);
  const width = Math.round(
    Math.min(MAX_BOX_W * roomy, Math.max(base.width, Math.max(...lineW) + PAD_PX)),
  );
  const lines = lineW.reduce((n, w) => n + Math.max(1, Math.ceil(w / (width - PAD_PX))), 0);
  const height = Math.round(Math.max(base.height, lines * LINE_PX + 28) * (lines > 1 ? roomy : 1));
  return { width, height };
}

// A box in the template look: the kind's floor, wider for a longer label up to the cap, then taller by a line for
// each wrap. A circle stays round and a diamond's text gets the room its inner half leaves.
function lookBoxSize(
  label: string | undefined,
  kind: string,
  look: GraphLook,
  hasIcon: boolean,
  given?: { width: number; height: number },
): { width: number; height: number } {
  const base = SHAPE_DEFAULT_SIZE[kind as keyof typeof SHAPE_DEFAULT_SIZE];
  const floor = given ?? LOOK_FLOOR[kind] ?? base;
  const text = (label ?? '').trim();
  if (!text) return { ...floor };
  const px = look.fontPx ?? LOOK_FONT_PX[look.textSize];
  // The wrap width grows with a larger font, so a line holds as many words.
  const maxW = LOOK_MAX_W[look.textSize] * Math.max(1, px / LOOK_FONT_PX[look.textSize]);
  // An inline icon beside the label takes its glyph and gap (inlineIconMetrics: about 1.6 × the font, a third
  // of that again between).
  const iconRoom = hasIcon ? Math.round(px * 1.6 * 1.32) : 0;
  const roomy =
    kind === 'diamond' ? 1.5 : kind === 'parallelogram' || kind === 'hexagon' ? 1.15 : 1;
  // A label written over several lines is measured line by line: its widest line sets the width, and each wraps on its own.
  const lineW = text.split('\n').map((l) => glyphUnits(l) * px * GLYPH_EM * roomy);
  const textW = Math.max(...lineW) + iconRoom;
  const pad = 48;
  const width = Math.round(Math.min(maxW * roomy, Math.max(floor.width, textW + pad)));
  const lines = lineW.reduce(
    (n, w, i) => n + Math.max(1, Math.ceil((w + (i === 0 ? iconRoom : 0)) / (width - pad))),
    0,
  );
  const textH = lines * px * LINE_EM + 28;
  // A box joining siblings keeps their height while it holds the one line with room above and below.
  const siblingHolds = !!given && lines === 1 && given.height >= px * LINE_EM + 16;
  const height = siblingHolds
    ? given.height
    : Math.round(Math.max(floor.height, kind === 'diamond' ? textH * 1.6 : textH));
  if (kind === 'circle') {
    const side = Math.max(width, height);
    return { width: side, height: side };
  }
  return { width, height };
}

// The words that start a clause after a noun phrase: "Orders service WHICH
// creates orders", "Message queue FOR async events". The part before the first
// one is the heading a person would have written.
const CLAUSE_START =
  /\s(?:which|that|who|whom|whose|where|when|for|to|with|by|holding|sending|serving|served|handling|storing|running|using|used|responsible)\s/i;

// Whether `s` is at most `max` characters (code points, as names count them in truncateName: an
// emoji is one, never two). Stops counting past `max`, so a long label costs no more than a short one.
function fitsIn(s: string, max: number): boolean {
  if (s.length <= max) return true;
  let n = 0;
  for (const _ of s) if (++n > max) return false;
  return true;
}

// The first `k` characters of `s`, never ending on half a surrogate pair.
function firstChars(s: string, k: number): string {
  let out = '';
  let n = 0;
  for (const ch of s) {
    if (n++ >= k) break;
    out += ch;
  }
  return out;
}

// A label within `max` characters. When it runs over, bracketed asides go
// first ("Web client (React SPA served from the CDN)" is "Web client"); then
// the heading is the noun phrase before the first clause word, if there is one
// of at least two words; otherwise the text is cut at a word boundary and
// marked with an ellipsis. Returns the text unchanged when it already fits.
//
// The text is untrusted (any API token's changeset reaches it), so every pass is a linear scan:
// the regular expressions these replace backtracked quadratically over a long run of spaces,
// brackets or punctuation.
export function capLabel(text: string, max = GRAPH_LABEL_MAX): { label: string; cut: boolean } {
  // A label that fits keeps the line breaks it was written with ("App tasks\nECS Fargate"), runs of other space
  // made one; one that is cut is read as one line.
  const lines = text
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
  if (fitsIn(lines, max)) return { label: lines, cut: false };
  const whole = text.replace(/\s+/g, ' ').trim();
  const clean = withoutAsides(whole).trim() || whole;
  if (fitsIn(clean, max)) return { label: clean, cut: true };
  const clause = CLAUSE_START.exec(clean);
  if (clause) {
    const head = trimTrailingPunctuation(clean.slice(0, clause.index));
    if (fitsIn(head, max) && head.includes(' ')) return { label: head, cut: true };
  }
  // Cut by characters, so a surrogate pair is never split into a lone half.
  const room = firstChars(clean, max - 1);
  const space = room.lastIndexOf(' ');
  const head = space > max * 0.5 ? room.slice(0, space) : room;
  return { label: `${trimTrailingPunctuation(head)}…`, cut: true };
}

const OPENERS = new Set(['(', '[']);
const CLOSERS = new Set([')', ']']);
const TRAILING = new Set([',', ';', ':', '.', '-']);
const isSpace = (ch: string) => /\s/.test(ch);

// Every bracketed aside with the whitespace before it: an opener up to the first closer after it,
// of either kind, as `\s*[([][^)\]]*[)\]]` matched. An opener with no closer after it stays.
function withoutAsides(text: string): string {
  const nextCloser = new Array<number>(text.length + 1).fill(-1);
  for (let i = text.length - 1; i >= 0; i -= 1) {
    nextCloser[i] = CLOSERS.has(text[i + 1] ?? '') ? i + 1 : nextCloser[i + 1]!;
  }
  // Characters kept so far; popping the whitespace before an aside costs only what it removes.
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const close = OPENERS.has(text[i]!) ? nextCloser[i]! : -1;
    if (close === -1) {
      out.push(text[i]!);
      continue;
    }
    while (out.length > 0 && isSpace(out[out.length - 1]!)) out.pop();
    i = close;
  }
  return out.join('');
}

// The text without trailing whitespace and `, ; : . -`, as `[\s,;:.-]+$` removed them.
function trimTrailingPunctuation(text: string): string {
  let end = text.length;
  while (end > 0 && (TRAILING.has(text[end - 1]!) || isSpace(text[end - 1]!))) end -= 1;
  return text.slice(0, end);
}
