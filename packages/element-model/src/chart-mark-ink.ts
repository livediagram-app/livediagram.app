// A chart's series and text adapted to what it sits on (docs/specs/007-editor/pages-mode.md "Charts adapt as they
// are drawn"): a series colour under 3:1 against its ground is lightened or darkened, keeping its hue, by the least
// that reaches 3:1; the chart's own small text (axis labels, the key) is held to 4.5:1. Never stored. With no ground
// (a chart not on a filled page), colours are drawn as they are. Pure; the canvas and every export draw through these.
import { inkToward } from './page-ink-contrast';
import { PAGE_INK_CONTRAST, PAGE_INK_TARGET, PAGE_LINE_CONTRAST } from './page-ink-rules';

// A series (a line, a bar, a wedge, a Sankey node) against its ground: WCAG 2.2 SC 1.4.11
// non-text contrast, floor and target both, as re-inking holds lines and marks.
export const CHART_MARK_CONTRAST = PAGE_LINE_CONTRAST;
// A chart's own text (9px axis labels, the key, a Sankey's node names): moved under WCAG 2.2
// SC 1.4.3 AA, to AAA, as re-inking moves a page's text.
export const CHART_TEXT_CONTRAST = PAGE_INK_CONTRAST;
export const CHART_TEXT_TARGET = PAGE_INK_TARGET;
// How many adapted colours are remembered across draws (a hover re-draws a chart every move).
// A board's charts use a few dozen colours on a few grounds; past this the memory starts over.
// Safe range 64 to 4096: smaller recomputes on busy boards, larger only holds more strings.
const CHART_INK_MEMORY = 512;

const memory = new Map<string, string>();

function adapted(
  color: string,
  tones: readonly string[],
  floor: number,
  target: number = floor,
): string {
  const key = `${floor}|${target}|${color}|${tones.join(',')}`;
  const hit = memory.get(key);
  if (hit !== undefined) return hit;
  const out = inkToward(color, tones, floor, target);
  if (memory.size >= CHART_INK_MEMORY) memory.clear();
  memory.set(key, out);
  return out;
}

/** A series colour as drawn on `ground` (the tones the chart sits on): unchanged with no ground or
 *  while it reaches 3:1 against every tone; else the least change, keeping its hue, that does. */
export function chartMarkInk(color: string, ground: readonly string[] | undefined): string {
  return ground && ground.length > 0 ? adapted(color, ground, CHART_MARK_CONTRAST) : color;
}

/** A chart's own text colour as drawn on `ground`: kept at 4.5:1 or over, else taken to 7:1. */
export function chartTextInk(color: string, ground: readonly string[] | undefined): string {
  return ground && ground.length > 0
    ? adapted(color, ground, CHART_TEXT_CONTRAST, CHART_TEXT_TARGET)
    : color;
}
