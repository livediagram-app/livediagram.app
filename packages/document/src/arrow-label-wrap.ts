// Word wrapping for arrow labels (docs/specs/008-canvas/blueprints/arrow-labels.md).
//
// Works on per-word widths rather than measuring joined strings, so a layout
// pass that re-wraps the same label at several widths measures each word once
// (the caller hands in a cached measure).

export type TextMeasure = (s: string) => number;

export type WrappedText = { lines: string[]; width: number };

// Binary-search steps for the balanced width; 8 halvings of a <= 320px range
// land within about a pixel.
const BALANCE_STEPS = 8;

function words(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

export function longestWordWidth(text: string, measure: TextMeasure): number {
  let widest = 0;
  for (const w of words(text)) widest = Math.max(widest, measure(w));
  return widest;
}

// Greedy wrap at `maxWidth`, keeping the author's explicit line breaks. A word
// wider than `maxWidth` sits on its own line unbroken.
export function wrapGreedy(text: string, maxWidth: number, measure: TextMeasure): WrappedText {
  const space = measure(' ');
  const lines: string[] = [];
  let width = 0;
  for (const para of text.split('\n')) {
    const ws = words(para);
    if (ws.length === 0) {
      lines.push('');
      continue;
    }
    let cur = ws[0]!;
    let curW = measure(cur);
    for (let i = 1; i < ws.length; i++) {
      const w = ws[i]!;
      const wW = measure(w);
      if (curW + space + wW <= maxWidth) {
        cur += ` ${w}`;
        curW += space + wW;
      } else {
        lines.push(cur);
        width = Math.max(width, curW);
        cur = w;
        curW = wW;
      }
    }
    lines.push(cur);
    width = Math.max(width, curW);
  }
  return { lines, width };
}

// The narrowest wrap with the same line count as the greedy wrap at
// `maxWidth`, so a two-line label splits evenly instead of stranding a word.
export function wrapBalanced(text: string, maxWidth: number, measure: TextMeasure): WrappedText {
  const greedy = wrapGreedy(text, maxWidth, measure);
  if (greedy.lines.length <= 1) return greedy;
  let lo = longestWordWidth(text, measure);
  let hi = greedy.width;
  let best = greedy;
  for (let i = 0; i < BALANCE_STEPS && lo < hi; i++) {
    const mid = (lo + hi) / 2;
    const trial = wrapGreedy(text, mid, measure);
    if (trial.lines.length <= greedy.lines.length) {
      best = trial;
      hi = trial.width;
    } else {
      lo = mid + 0.01;
    }
  }
  // The search stops within a pixel of the optimum; one wrap at the exact
  // lower bound catches the case where it is reachable.
  const floor = wrapGreedy(text, lo, measure);
  if (floor.lines.length <= greedy.lines.length && floor.width < best.width) best = floor;
  return best;
}
