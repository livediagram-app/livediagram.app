// A layout's paired texts, written as one (docs/specs/007-editor/describe-a-page.md "Every kind", "Cards written
// whole"; blueprint "The asks"). A card's number and its caption, a stat's figure and its caption, a KPI's label, value
// and change: asked for as flat lists (every figure, then every caption) a model pairs them wrongly, so each is a
// group the model writes as one object ({"figure", "caption"}; a KPI {"label", "value", "delta"}) and the code maps
// back to the group's slots. A group is a card's texts (the plain box they sit in), a stat of a stat row, or a free
// big figure with the lines set under it in its column. Pure: read from the layout as built.
import { partsOf, type SlotElement } from '@liveworkspace/edit-operations/layout-slots';

/** One text of a layout as page-draft-slots.ts reads it: its slot, element, part of a compound element, and card. */
export type SlotRead = {
  slot: string;
  el: SlotElement;
  part: number | null;
  card: SlotElement | null;
};

/** One member of a group: what the model calls it, and the slot it is written into. */
export type GroupMember = { key: string; slot: string };

export type SlotGroup = {
  members: GroupMember[];
  // The keys that must both be written for the group to stay: its big text and its first line. The rest (a delta, a
  // detail) may be "".
  required: readonly string[];
  // The key holding the group's number: two groups never show the same.
  figure: string;
  // The stat row a stat sits in, so a short list is spread over the rows (4 stats on two rows of 3: 2 and 2).
  row: string | null;
};

type Box = { x: number; y: number; width: number; height: number };
const boxOf = (el: SlotElement): Box => ({
  x: el.x ?? 0,
  y: el.y ?? 0,
  width: el.width ?? 0,
  height: el.height ?? 0,
});

// A text with a digit in it is a figure ("4 min", "73%", "+18%"); the slot name alone misses "4 min".
const isNumberish = (text: string) => /\d/.test(text);
// A change against an earlier figure: "+18%", "-0.4 pts", "−3".
const isChange = (text: string) => /^[+\-−±]\s?\d/.test(text.trim());

// The most lines one group takes under its figure: a card's caption, a detail and one more; a column's caption and
// a detail (the lines further down a poster are its own).
const CARD_LINES_MAX = 3;
const COLUMN_LINES_MAX = 2;
// A free figure leads a column only when it is this much larger than the lines it takes.
const COLUMN_FIGURE_SCALE = 1.5;
// A line is in a figure's column when no wider than this many of the figure's widths, and starts within this many
// of its heights from its top (a source line at the page's foot is the page's, not the figure's).
const COLUMN_REACH = 2.5;
// A line is in a figure's column when no wider than this many of the figure's widths.
const COLUMN_WIDTH_SCALE = 1.6;

/**
 * The group of a figure and the lines with it, keyed as a model writes it: the figure `figure` (`value` under a
 * label), a line above it `label`, the first line under it `caption` (or `delta` when it is a change under a labelled
 * value), the next `detail`, then `detail2`.
 */
function groupOf(
  big: { slot: string },
  above: readonly { slot: string }[],
  below: readonly { slot: string; text: string }[],
  row: string | null,
): SlotGroup {
  const label = above[0];
  const lines = below;
  const bigKey = label ? 'value' : 'figure';
  const members: GroupMember[] = [];
  if (label) members.push({ key: 'label', slot: label.slot });
  members.push({ key: bigKey, slot: big.slot });
  lines.forEach((b, i) =>
    members.push({
      key:
        i === 0
          ? label && isChange(b.text)
            ? 'delta'
            : 'caption'
          : i === 1
            ? 'detail'
            : 'detail2',
      slot: b.slot,
    }),
  );
  // The big text and the line that says what it is: a label above it, else the caption under it. A labelled value's
  // change (its delta) may be left out.
  const first = label ? 'label' : 'caption';
  return { members, required: [bigKey, first], figure: bigKey, row };
}

/**
 * The layout's groups, in the order a reader meets them. `read` is every text with its card (page-draft-slots.ts);
 * `heading` and `under` the page's heading and the line under it (never in a group); `sizeOf` the px a text draws at;
 * `textOf` a slot's sample words.
 */
export function slotGroups(
  read: readonly SlotRead[],
  heading: SlotRead | null,
  under: SlotRead | null,
  sizeOf: (el: SlotElement) => number,
  textOf: (slot: string) => string,
): SlotGroup[] {
  const groups: { at: number; group: SlotGroup }[] = [];
  const order = (slot: string) => read.findIndex((r) => r.slot === slot);
  const word = (r: SlotRead) => ({ slot: r.slot, text: textOf(r.slot) });

  // A stat of a stat row: its figure and its caption.
  const stats = new Map<string, { figure?: SlotRead; caption?: SlotRead; row: string }>();
  for (const r of read) {
    if (r.part === null) continue;
    const at = partsOf(r.el)[r.part]?.at;
    if (!at || at.field !== 'stats') continue;
    const key = `${r.el.id}#${at.index}`;
    const stat = stats.get(key) ?? { row: r.el.id };
    stat[at.key === 'value' ? 'figure' : 'caption'] = r;
    stats.set(key, stat);
  }
  for (const s of stats.values())
    if (s.figure && s.caption)
      groups.push({
        at: order(s.figure.slot),
        group: groupOf(word(s.figure), [], [word(s.caption)], s.row),
      });

  // A card's texts, when its largest is a number and the card holds no other (a list of numbered items is no pair):
  // the rest above or under it by where they sit. A KPI's change under its value is no other number.
  const byCard = new Map<SlotElement, SlotRead[]>();
  for (const r of read) if (r.card) byCard.set(r.card, [...(byCard.get(r.card) ?? []), r]);
  const loneFigureCards = new Map<SlotRead, SlotElement>();
  for (const [card, mates] of byCard) {
    if (mates.length === 1) {
      if (mates[0]!.slot.startsWith('figures[')) loneFigureCards.set(mates[0]!, card);
      continue;
    }
    const big = mates.reduce((a, b) => (sizeOf(b.el) > sizeOf(a.el) ? b : a));
    const others = mates.filter((m) => m !== big);
    if (
      !isNumberish(textOf(big.slot)) ||
      others.some((m) => m.slot.startsWith('figures[') && !isChange(textOf(m.slot)))
    )
      continue;
    const bigY = boxOf(big.el).y;
    const lines = others.sort((a, b) => boxOf(a.el).y - boxOf(b.el).y);
    const group = groupOf(
      word(big),
      lines.filter((m) => boxOf(m.el).y < bigY).map(word),
      lines
        .filter((m) => boxOf(m.el).y >= bigY)
        .slice(0, CARD_LINES_MAX)
        .map(word),
      null,
    );
    groups.push({ at: Math.min(...mates.map((m) => order(m.slot))), group });
  }

  // A free big figure (or one alone in its card) and the free lines set under it, in its column: never the page's
  // heading or the line under it, nor a bullet.
  const free = read.filter(
    (r) => r.part === null && r.card === null && r.slot !== 'table' && r !== heading && r !== under,
  );
  const anchors = [
    ...free.filter((r) => r.slot.startsWith('figures[')).map((r) => ({ r, box: boxOf(r.el) })),
    ...[...loneFigureCards].map(([r, card]) => ({ r, box: boxOf(card) })),
  ];
  const columns = new Map<SlotRead, SlotRead[]>();
  for (const m of free) {
    if (anchors.some((a) => a.r === m) || m.slot.startsWith('bullets[')) continue;
    const box = boxOf(m.el);
    const cx = box.x + box.width / 2;
    let best: (typeof anchors)[number] | null = null;
    for (const a of anchors) {
      const inColumn =
        cx >= a.box.x &&
        cx <= a.box.x + a.box.width &&
        box.width <= a.box.width * COLUMN_WIDTH_SCALE &&
        box.y >= a.box.y + a.box.height / 2 &&
        box.y <= a.box.y + a.box.height * COLUMN_REACH &&
        sizeOf(a.r.el) >= sizeOf(m.el) * COLUMN_FIGURE_SCALE;
      if (inColumn && (!best || a.box.y > best.box.y)) best = a;
    }
    if (best) columns.set(best.r, [...(columns.get(best.r) ?? []), m]);
  }
  for (const [anchor, lines] of columns) {
    const sorted = [...lines].sort((a, b) => boxOf(a.el).y - boxOf(b.el).y);
    groups.push({
      at: order(anchor.slot),
      group: groupOf(word(anchor), [], sorted.slice(0, COLUMN_LINES_MAX).map(word), null),
    });
  }
  return groups.sort((a, b) => a.at - b.at).map((g) => g.group);
}

/** The slots every group holds: written through the groups, never listed alone. */
export const groupedSlots = (groups: readonly SlotGroup[]): Set<string> =>
  new Set(groups.flatMap((g) => g.members.map((m) => m.slot)));

/** A group as the model sees it: its keys with the layout's sample words. */
export const groupSample = (
  group: SlotGroup,
  textOf: (slot: string) => string,
): Record<string, string> => Object.fromEntries(group.members.map((m) => [m.key, textOf(m.slot)]));

// A figure as two groups are compared: case, spaces and thousands marks aside.
const figureKey = (text: string) => text.toLowerCase().replace(/[\s,]/g, '');

export type GroupsRead = {
  // Every grouped slot's words: "" where the page drops it.
  words: Map<string, string>;
  // Groups dropped for a figure an earlier one already shows.
  duplicates: number;
};

/**
 * The groups' words from the model's list of objects: each object a group's keys, kept only with both required
 * halves written (a figure with no caption goes, as does a caption with no figure), and never a figure an earlier
 * group shows. The kept ones fill the groups in order, spread evenly over a layout's stat rows, and every group left
 * over is "" for the page to drop. `words` reads one text as a slot keeps it ("" for a placeholder).
 */
export function readGroups(
  groups: readonly SlotGroup[],
  items: unknown,
  words: (text: unknown) => string,
): GroupsRead {
  const out = new Map<string, string>();
  for (const g of groups) for (const m of g.members) out.set(m.slot, '');
  let duplicates = 0;
  const list = Array.isArray(items) ? items : [];
  const kept: Record<string, string>[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (kept.length >= groups.length) break;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const given = item as Record<string, unknown>;
    // A model writing a KPI's value as "figure", or a stat's as "value", means the same.
    const read: Record<string, string> = {};
    for (const [key, value] of Object.entries(given)) read[key] = words(value);
    read['figure'] ||= read['value'] ?? '';
    read['value'] ||= read['figure'];
    const next = groups[kept.length]!;
    if (next.required.some((k) => !read[k])) continue;
    const figure = figureKey(read[next.figure]!);
    if (seen.has(figure)) {
      duplicates += 1;
      continue;
    }
    seen.add(figure);
    kept.push(read);
  }
  const places = placesFor(groups, kept.length);
  kept.forEach((read, i) => {
    for (const m of groups[places[i]!]!.members) out.set(m.slot, read[m.key] ?? '');
  });
  return { words: out, duplicates };
}

/** Which groups `n` written ones go into: the first `n`, except on stat rows, spread evenly over the rows. */
export function placesFor(groups: readonly SlotGroup[], wanted: number): number[] {
  const n = Math.min(wanted, groups.length);
  const rows = [...new Set(groups.map((g) => g.row))];
  if (rows.length < 2 || rows.includes(null)) return Array.from({ length: n }, (_, i) => i);
  const byRow = rows.map((row) => groups.flatMap((g, i) => (g.row === row ? [i] : [])));
  const places: number[] = [];
  // Round by round, a row at a time, while a row has room: 4 over two rows of 3 is 2 and 2, in reading order. `n` is
  // at most the groups, so every round places one at least.
  for (let round = 0; places.length < n; round++)
    for (const row of byRow) if (places.length < n && round < row.length) places.push(row[round]!);
  return places.sort((a, b) => a - b);
}
