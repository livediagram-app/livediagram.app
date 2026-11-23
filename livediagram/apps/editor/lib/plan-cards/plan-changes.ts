// Changes to the plan from its drawing (docs/specs/013-workspace/make-plan-cards.md "Changes to the plan"; the
// platform's diagrams-and-plans.md "Element ids"): on a tab View As Diagram drew, an arrow someone drew between two
// card boxes offers "blocked by", and a card box dragged into another lane offers a move to that lane's column. Only
// offers: nothing reaches the plan until the person applies one, and the plan's next redraw puts the picture right.
// Pure and linear in the tab's elements.
import { isBoxed, type BoxedElement, type Element } from '@livediagram/document';
import { PLAN_EDITS_MAX, readPlanElementId, type PlanEdit } from '@liveworkspace/index-client';

export type PlanChangeOffer = {
  // Stable across renders, for Dismiss.
  key: string;
  edit: PlanEdit;
  // The words the pill lists: "Design waits on Research", "Ship moves to Done".
  words: string;
};

const labelOf = (el: Element): string => {
  const label = (el as { label?: string }).label;
  return typeof label === 'string' ? label.split('\n')[0]!.trim() : '';
};

// The plan a drawn tab came from: its caption's link (`…/project/<plan>#…`), or null on any other tab.
export function drawnPlanOf(elements: readonly Element[]): string | null {
  const caption = elements.find((el) => el.id === 'plan:caption');
  const link = caption && (caption as { link?: { kind: string; url?: string } }).link;
  if (!link || link.kind !== 'url' || typeof link.url !== 'string') return null;
  const at = link.url.indexOf('/project/');
  if (at < 0) return null;
  const rest = link.url.slice(at + '/project/'.length);
  let end = 0;
  while (end < rest.length && rest[end] !== '#' && rest[end] !== '?' && rest[end] !== '/') end += 1;
  const plan = rest.slice(0, end);
  return plan ? plan : null;
}

const inside = (outer: BoxedElement, inner: BoxedElement) => {
  const x = inner.x + inner.width / 2;
  const y = inner.y + inner.height / 2;
  return x >= outer.x && x <= outer.x + outer.width && y >= outer.y && y <= outer.y + outer.height;
};

/** The offers this drawn tab holds, minus those dismissed; at most PLAN_EDITS_MAX. */
export function planChangeOffers(
  elements: readonly Element[],
  dismissed: ReadonlySet<string> = new Set(),
): PlanChangeOffer[] {
  const cards = new Map<string, { card: string; lane: string; el: BoxedElement }>();
  const lanes: { lane: string; el: BoxedElement }[] = [];
  const deps = new Set<string>();
  for (const el of elements) {
    const read = readPlanElementId(el.id);
    if (!read) continue;
    if (read.kind === 'card' && isBoxed(el)) cards.set(el.id, { card: read.card, lane: read.lane, el });
    else if (read.kind === 'lane' && isBoxed(el)) lanes.push({ lane: read.lane, el });
    else if (read.kind === 'dep') deps.add(`${read.blocker}>${read.card}`);
  }
  const offers: PlanChangeOffer[] = [];
  const push = (o: PlanChangeOffer) => {
    if (!dismissed.has(o.key) && !offers.some((x) => x.key === o.key)) offers.push(o);
  };
  for (const el of elements) {
    if (el.type !== 'arrow' || readPlanElementId(el.id)) continue;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned' || el.arrowEnds === 'both') continue;
    let [a, b] = [cards.get(el.from.elementId), cards.get(el.to.elementId)];
    if (el.arrowEnds === 'from') [a, b] = [b, a];
    if (!a || !b || a.card === b.card || deps.has(`${a.card}>${b.card}`)) continue;
    push({
      key: `block:${a.card}>${b.card}`,
      edit: { kind: 'block', card: b.card, blocker: a.card },
      words: `${labelOf(b.el) || 'A card'} waits on ${labelOf(a.el) || 'another card'}`,
    });
  }
  for (const { card, lane, el } of cards.values()) {
    if (lanes.some((l) => l.lane === lane && inside(l.el, el))) continue;
    const now = lanes.find((l) => inside(l.el, el));
    const column = now ? labelOf(now.el) : '';
    if (!now || !column) continue;
    push({
      key: `move:${card}>${now.lane}`,
      edit: { kind: 'move', card, column },
      words: `${labelOf(el) || 'A card'} moves to ${column}`,
    });
  }
  return offers.slice(0, PLAN_EDITS_MAX);
}
