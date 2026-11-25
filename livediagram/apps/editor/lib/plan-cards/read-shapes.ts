// Make Plan Cards' reading of a tab (docs/specs/013-workspace/make-plan-cards.md "What becomes what"): each shape or
// sticky with words is a card; an arrow pinned between two of them is a Blocked By (the shape the head points at waits
// on the other); the lane or frame a shape sits in names its column or label; dates come from its words ("1 Dec to
// 12 Dec", "by Friday") or, on a timeline, from where it stands against the dates written along the axis. Pure and
// linear in the tab's elements (containers are few; each shape checks them once), measured at 500 shapes in
// read-shapes.perf.test.ts.
import {
  elementSupportsText,
  isBoxed,
  type BoxedElement,
  type Element,
} from '@livediagram/document';
import type { MakeShape } from './make-plan-rows';
import {
  readSendSpan,
  readSendWords,
  readWholeDate,
} from '@liveworkspace/workbench/components/send-to-plan/send-words';

type Box = { x: number; y: number; width: number; height: number };

// Shapes that hold others (a lane, a frame), never cards themselves.
const isContainer = (el: Element): el is BoxedElement =>
  el.type === 'shape' && (el.shape === 'lane' || el.shape === 'frame');

const labelOf = (el: Element): string => {
  const label = (el as { label?: string }).label;
  return typeof label === 'string' ? label.trim() : '';
};

// A plan's own drawing (View As Diagram) names its boxes `card:…`: never read back into cards.
const isCandidate = (el: Element): el is BoxedElement =>
  (el.type === 'sticky' ||
    (el.type === 'shape' &&
      el.shape !== 'lane' &&
      el.shape !== 'frame' &&
      el.shape !== 'timeline-rail')) &&
  elementSupportsText(el) &&
  !el.id.includes(':') &&
  labelOf(el) !== '';

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const holds = (outer: Box, x: number, y: number) =>
  x >= outer.x && x <= outer.x + outer.width && y >= outer.y && y <= outer.y + outer.height;

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const msOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
};

/** The timeline's axis: dates written alone along it, as (x, day) marks, when two or more stand apart. */
export function timelineAxis(
  elements: readonly Element[],
  today: Date,
): ((x: number) => string) | null {
  const marks: { x: number; ms: number }[] = [];
  for (const el of elements) {
    if (!isBoxed(el) || (el.type !== 'text' && el.type !== 'shape')) continue;
    const day = readWholeDate(labelOf(el), today);
    if (day) marks.push({ x: el.x + el.width / 2, ms: msOf(day) });
  }
  if (marks.length < 2) return null;
  marks.sort((a, b) => a.x - b.x);
  const first = marks[0]!;
  const last = marks[marks.length - 1]!;
  // An axis runs forward: later dates further right, and some width between its ends.
  if (last.x - first.x < 40 || last.ms <= first.ms) return null;
  const perPx = (last.ms - first.ms) / (last.x - first.x);
  return (x) => dayOf(first.ms + (x - first.x) * perPx);
}

/**
 * The tab's shapes as cards, in reading order (lane by lane, then top to bottom, left to right). `only` keeps the
 * selection's shapes; arrows and lanes are still read from the whole tab, a link kept only between kept shapes.
 */
export function readPlanShapes(
  elements: readonly Element[],
  { only = null, today }: { only?: ReadonlySet<string> | null; today: Date },
): MakeShape[] {
  const containers = elements.filter(isContainer);
  const axis = timelineAxis(elements, today);
  const shapes: (MakeShape & { at: { lane: number; x: number; y: number } })[] = [];
  const kept = new Set<string>();
  for (const el of elements) {
    if (!isCandidate(el) || (only && !only.has(el.id))) continue;
    const c = centre(el);
    // The smallest lane or frame holding the shape's centre.
    let home: BoxedElement | null = null;
    let homeIndex = -1;
    for (let i = 0; i < containers.length; i += 1) {
      const k = containers[i]!;
      if (!holds(k, c.x, c.y)) continue;
      if (!home || k.width * k.height < home.width * home.height) {
        home = k;
        homeIndex = i;
      }
    }
    const text = labelOf(el);
    const span = readSendSpan(text, today);
    const words = span ? null : readSendWords(text, today);
    const title = (span?.title || words?.title || text.split('\n')[0]!).trim();
    let start = span?.start;
    let due = span?.due ?? words?.due ?? undefined;
    if (!start && !due && axis) {
      start = axis(el.x);
      due = axis(el.x + el.width);
      if (due < start) due = start;
    }
    const lane = home ? labelOf(home) : '';
    kept.add(el.id);
    shapes.push({
      element: el.id,
      title: title || 'Untitled',
      text,
      ...(lane ? { lane: lane.split('\n')[0]!.trim() } : {}),
      ...(start ? { start } : {}),
      ...(due ? { due } : {}),
      blockedBy: [],
      at: { lane: homeIndex, x: el.x, y: el.y },
    });
  }
  const byId = new Map(shapes.map((s) => [s.element, s]));
  for (const el of elements) {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    // Heads at both ends or none say no order.
    if (el.arrowEnds === 'both' || el.arrowEnds === 'none') continue;
    let [blocker, waiter] = [el.from.elementId, el.to.elementId];
    if (el.arrowEnds === 'from') [blocker, waiter] = [waiter, blocker];
    if (blocker === waiter || !kept.has(blocker)) continue;
    const s = byId.get(waiter);
    if (s && !s.blockedBy.includes(blocker)) s.blockedBy.push(blocker);
  }
  // Reading order: lane by lane, then rows (a band of 40px), then left to right.
  shapes.sort(
    (a, b) =>
      a.at.lane - b.at.lane || Math.floor(a.at.y / 40) - Math.floor(b.at.y / 40) || a.at.x - b.at.x,
  );
  return shapes.map(({ at: _at, ...s }) => s);
}

/** How many shapes Make Plan Cards would read here, counted up to `upTo` (an entry asks only "one?" or "two?"). */
export function countPlanShapes(elements: readonly Element[], upTo: number): number {
  let n = 0;
  for (const el of elements) if (isCandidate(el) && (n += 1) >= upTo) break;
  return n;
}
