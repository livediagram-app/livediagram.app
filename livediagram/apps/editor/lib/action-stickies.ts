// Make These a Plan's trigger (docs/specs/013-workspace/suggestions.md): the stickies on a tab that are actions, a
// sticky with words that holds an assigned action, or one in an Actions lane (a panel or shape holding a heading that
// reads "Actions", "Action items", "Next steps" or "To do"). Pure, one pass to find the headings and their lanes, one
// over the stickies: linear in the elements but for the few lanes (measured in action-stickies.test.ts).

/** How many action stickies make the suggestion. */
export const ACTION_STICKIES_MIN = 3;

type Placed = {
  id: string;
  type: string;
  label?: unknown;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  action?: { status?: string } | null;
};

type Box = { x: number; y: number; w: number; h: number };

const boxOf = (el: Placed): Box => ({
  x: el.x ?? 0,
  y: el.y ?? 0,
  w: el.width ?? 0,
  h: el.height ?? 0,
});

const holds = (b: Box, x: number, y: number) =>
  x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

const words = (el: Placed): string => (typeof el.label === 'string' ? el.label.trim() : '');

// A label's first line as lower-case words, read left to right (letters and digits only, no regular expression).
function firstLineWords(label: string, max: number): string[] {
  const out: string[] = [];
  let word = '';
  for (let i = 0; i < label.length && out.length <= max; i++) {
    const c = label[i]!;
    if (c === '\n') break;
    const lower = c.toLowerCase();
    if (lower !== c.toUpperCase() || (c >= '0' && c <= '9')) word += lower;
    else if (word) {
      out.push(word);
      word = '';
    }
  }
  if (word) out.push(word);
  return out;
}

const HEADINGS: readonly (readonly string[])[] = [
  ['action'],
  ['actions'],
  ['action', 'items'],
  ['action', 'item'],
  ['action', 'points'],
  ['next', 'steps'],
  ['to', 'do'],
  ['todo'],
  ['todos'],
];

/** Whether a label reads as an Actions lane's heading. */
export function isActionHeading(label: string): boolean {
  const w = firstLineWords(label, 3);
  return HEADINGS.some((h) => h.length === w.length && h.every((part, i) => part === w[i]));
}

/** The tab's action stickies with words, in reading order (top to bottom, then left to right). */
export function actionStickies<T extends Placed>(elements: readonly T[]): T[] {
  // The lanes: for each heading, the smallest other element (not a sticky) whose box holds the heading's centre.
  const lanes: Box[] = [];
  for (const el of elements) {
    if (el.type === 'sticky' || !isActionHeading(words(el))) continue;
    const head = boxOf(el);
    const cx = head.x + head.w / 2;
    const cy = head.y + head.h / 2;
    let best: Box | null = null;
    for (const other of elements) {
      if (other === el || other.type === 'sticky') continue;
      const b = boxOf(other);
      if (b.w * b.h <= head.w * head.h || !holds(b, cx, cy)) continue;
      if (!best || b.w * b.h < best.w * best.h) best = b;
    }
    if (best) lanes.push(best);
  }
  const found: T[] = [];
  for (const el of elements) {
    if (el.type !== 'sticky' || !words(el)) continue;
    const open = el.action && el.action.status !== 'wont-do';
    const b = boxOf(el);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (open || lanes.some((lane) => holds(lane, cx, cy))) found.push(el);
  }
  return found.sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
}
