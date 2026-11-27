// What each slot of a layout is on the page, for the model that writes it (docs/specs/007-editor/describe-a-page.md
// "Every kind"; blueprint "The asks"). A slot's name says how the layout kit read it (the largest words are `title`,
// a number is one of `figures`), not what it is: on a facts grid the largest words can be a card's "4 min" while the
// page's heading is `body[0]`. So each slot is told by its place: the page's heading and the line under it, a card's
// big text or its caption (a card being the plain box a text sits in), a stat, a step or a row of a compound element,
// or a text at a part of the page. And the words a model writes when it has nothing to say (placeholders) are known
// here, so they are never laid on a page.
import {
  partsOf,
  splitPartId,
  type LayoutTextSlot,
  type SlotElement,
} from '@liveworkspace/edit-operations/layout-slots';
import type { PageRect } from '@livedocuments/document';

type Box = { x: number; y: number; width: number; height: number };

/** Each slot's role in words, and which slot (if any) is the page's heading. */
export type SlotRoles = { roles: Map<string, string>; heading: string | null };

const boxOf = (el: SlotElement): Box => ({
  x: el.x ?? 0,
  y: el.y ?? 0,
  width: el.width ?? 0,
  height: el.height ?? 0,
});
const centreIn = (inner: Box, outer: Box) => {
  const cx = inner.x + inner.width / 2;
  const cy = inner.y + inner.height / 2;
  return (
    cx >= outer.x && cx <= outer.x + outer.width && cy >= outer.y && cy <= outer.y + outer.height
  );
};
const hasWords = (el: SlotElement) => typeof el.label === 'string' && el.label.trim() !== '';

// A plain box a text sits in: a shape with no words, no icon, no compound content of its own.
const isCard = (el: SlotElement) =>
  el.type === 'shape' &&
  el.shape !== 'icon' &&
  el.shape !== 'circle' &&
  !hasWords(el) &&
  partsOf(el).length === 0 &&
  (el.width ?? 0) > 0 &&
  (el.height ?? 0) > 0;

const third = (at: number, start: number, size: number, words: [string, string, string]) => {
  const f = size > 0 ? (at - start) / size : 0.5;
  return f < 1 / 3 ? words[0] : f < 2 / 3 ? words[1] : words[2];
};

const PART_WORDS: Record<string, string> = {
  stats: 'stat',
  processSteps: 'step',
  checklistItems: 'checklist item',
  conceptRows: 'row',
};

/**
 * Each slot's role, read from the layout as built on `page`. `sizeOf` is the px a text draws at. The heading is the
 * topmost text outside any card and any compound element; the line under it the next such text just below it.
 */
export function slotRoles(
  elements: readonly SlotElement[],
  slots: readonly LayoutTextSlot[],
  page: PageRect,
  sizeOf: (el: SlotElement) => number,
): SlotRoles {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const cards = elements.filter(isCard);
  const cardOf = (el: SlotElement) => {
    const box = boxOf(el);
    let best: SlotElement | null = null;
    for (const c of cards)
      if (centreIn(box, boxOf(c)) && (!best || c.width! * c.height! < best.width! * best.height!))
        best = c;
    return best;
  };
  type Read = { slot: string; el: SlotElement; part: number | null; card: SlotElement | null };
  const read: Read[] = slots.flatMap((s): Read[] => {
    if (!s.slot) return [];
    const { id, part } = splitPartId(s.id);
    const el = byId.get(part === null ? s.id : id);
    if (!el) return [];
    return [{ slot: s.slot, el, part: part === null || el.id === s.id ? null : part, card: null }];
  });
  for (const r of read) if (r.part === null && r.slot !== 'table') r.card = cardOf(r.el);
  const free = read
    .filter((r) => r.part === null && r.card === null && r.slot !== 'table')
    .sort((a, b) => boxOf(a.el).y - boxOf(b.el).y);
  const heading = free.find((r) => !r.slot.startsWith('figures[')) ?? null;
  const headBox = heading ? boxOf(heading.el) : null;
  const under =
    heading && headBox
      ? (free.find(
          (r) =>
            r !== heading &&
            !r.slot.startsWith('figures[') &&
            boxOf(r.el).y >= headBox.y + headBox.height * 0.5 &&
            boxOf(r.el).y <= headBox.y + headBox.height * 2.5 &&
            sizeOf(r.el) <= sizeOf(heading.el),
        ) ?? null)
      : null;
  // Cards and compound elements numbered in the layout's order, as the reader meets them.
  const cardNumbers = new Map<SlotElement, number>();
  const compoundNumbers = new Map<SlotElement, number>();
  for (const r of read) {
    if (r.card && !cardNumbers.has(r.card)) cardNumbers.set(r.card, cardNumbers.size + 1);
    if (r.part !== null && !compoundNumbers.has(r.el))
      compoundNumbers.set(r.el, compoundNumbers.size + 1);
  }
  const inCard = (card: SlotElement) => read.filter((r) => r.card === card);
  const roles = new Map<string, string>();
  for (const r of read) {
    const px = Math.round(sizeOf(r.el));
    let role: string;
    if (r.slot === 'table') role = 'the table, its header row first';
    else if (r === heading) role = `the page's heading, at the top (${px}px)`;
    else if (r === under) role = `the line under the page's heading (${px}px)`;
    else if (r.card) {
      const mates = inCard(r.card);
      const sizes = mates.map((m) => sizeOf(m.el));
      const big = mates.length > 1 && sizeOf(r.el) === Math.max(...sizes);
      const which = mates.length === 1 ? 'its text' : big ? 'its big text' : 'its smaller line';
      role = `card ${cardNumbers.get(r.card)} of ${cardNumbers.size}: ${which} (${px}px)`;
    } else if (r.part !== null) {
      const part = partsOf(r.el)[r.part];
      const at = part?.at;
      const what = at ? (PART_WORDS[at.field] ?? 'item') : 'item';
      const key =
        at && 'key' in at ? (at.key === 'value' ? ': its figure' : `: its ${at.key}`) : '';
      const group = compoundNumbers.size > 1 ? ` in group ${compoundNumbers.get(r.el)}` : '';
      role = `${what} ${(at?.index ?? 0) + 1}${group}${key}`;
    } else {
      const box = boxOf(r.el);
      const v = third(box.y + box.height / 2, page.y, page.height, ['top', 'middle', 'bottom']);
      const h = third(box.x + box.width / 2, page.x, page.width, ['left', 'centre', 'right']);
      role = `a text at the ${v} ${h === 'centre' ? '' : `${h} `}of the page (${px}px)`.replace(
        '  ',
        ' ',
      );
    }
    roles.set(r.slot, role);
  }
  return { roles, heading: heading?.slot ?? null };
}

// ---------- Placeholders

// Words that stand in for content nobody gave: "[Insert number here]", "N/A", "TBD", "Lorem ipsum", "XX%".
const PLACEHOLDER_LINE = /^(?:n\/?a|tbd|tbc|todo|null|undefined|-+|\?+|\.\.\.|…|x{2,}%?)$/i;
// A bracketed stand-in has words in it and is no Markdown link ("[Insert first example here]", not "[the guide](...)"
// or a task's "[x]").
const PLACEHOLDER_IN =
  /\[(?=[^\]]*\p{L}{2})[^\]]{0,80}\](?!\()|\{\{[^}]*\}\}|lorem ipsum|\binsert (?:\w+ ){0,4}here\b|\bplaceholder\b/iu;

/** True for words that only hold a place: a slot or a line with them is dropped, never shown. */
export function isPlaceholder(text: string): boolean {
  const t = text.trim();
  return t !== '' && (PLACEHOLDER_LINE.test(t) || PLACEHOLDER_IN.test(t));
}
