// A page layout's text slots (each paged product's docs/specs/024-agents/pages-for-agents.md "Text slots"): the
// names a change_pages call fills a layout's sample text by, so a deck or a set of screens is laid out and written in
// one call rather than laid out, read back and rewritten by ref. Slots are read from the built layout, never
// hand-marked on it, so every layout has them and a new one needs nothing: the headline (the largest words) is
// `title`, the line straight under it `subtitle`, each line set beside a bullet dot one of `bullets`, and every other
// text one of `body`, in the order the layout builds them (top to bottom, then the next column). A figure (a text with
// no letter, or a number with a unit or two: a time, "73%", "3.2M", a quote mark) is no slot: it stays as the layout
// set it, and its ref changes it.

/** The fields of an element the slots are read from: any product's element has them. */
export type SlotElement = {
  readonly id: string;
  readonly type: string;
  // Absent on an arrow, which is never a text or a dot.
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly label?: unknown;
  readonly shape?: unknown;
  readonly textBold?: unknown;
};

export const LAYOUT_SLOT_NAMES = ['title', 'subtitle', 'bullets', 'body'] as const;
export type LayoutSlotName = (typeof LAYOUT_SLOT_NAMES)[number];

/** What a change gives a layout's slots: a slot left out keeps the layout's sample. */
export type LayoutText = {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  body?: string[];
};

// The longest text one slot takes, and the most items a list slot takes (the fullest layout has 40 texts).
export const LAYOUT_TEXT_MAX = 2000;
export const LAYOUT_SLOT_ITEMS_MAX = 60;

/** One text of a laid-out page: its element and its slot (`title`, `bullets[2]`), or null for no slot. */
export type LayoutTextSlot = { id: string; slot: string | null };

// The element kinds whose label is words on the page: a shape's icon draws no label.
const isTexty = (el: SlotElement): el is SlotElement & { label: string } =>
  (el.type === 'text' || el.type === 'shape' || el.type === 'sticky') &&
  el.shape !== 'icon' &&
  typeof el.label === 'string' &&
  el.label.trim() !== '';

// Words, not a figure: a text with a letter in it, unless it is a number with a unit or two ("73%", "3.2M", "Q3").
const FIGURE_LETTERS_MAX = 2;
function isWords(label: string): boolean {
  const letters = label.match(/\p{L}/gu)?.length ?? 0;
  return letters > FIGURE_LETTERS_MAX || (letters > 0 && !/\d/.test(label));
}

const boxOf = (el: SlotElement): [number, number, number, number] => [
  el.x ?? 0,
  el.y ?? 0,
  el.width ?? 0,
  el.height ?? 0,
];

// A bullet's dot: the empty circle the bullet helper sets just before its line, left of it and level with it.
function isBulletDot(dot: SlotElement | undefined, line: SlotElement): boolean {
  if (!dot || dot.type !== 'shape' || dot.shape !== 'circle') return false;
  if (typeof dot.label === 'string' && dot.label.trim() !== '') return false;
  const [x, y, w, h] = boxOf(dot);
  const [lineX, lineY, , lineH] = boxOf(line);
  const middle = y + h / 2;
  return h < lineH && x + w <= lineX && middle >= lineY && middle <= lineY + lineH;
}

/** Each text's slot, in the layout's own order. `sizeOf` is the px a text's words draw at. */
export function layoutSlots(
  elements: readonly SlotElement[],
  sizeOf: (el: SlotElement) => number,
): LayoutTextSlot[] {
  const texts = elements
    .map((el, i) => ({ el, bullet: isBulletDot(elements[i - 1], el) }))
    .filter((t): t is { el: SlotElement & { label: string }; bullet: boolean } => isTexty(t.el));
  const worded = texts.filter((t) => isWords(t.el.label));
  let title: (typeof worded)[number] | undefined;
  for (const t of worded) if (!title || sizeOf(t.el) > sizeOf(title.el)) title = t;
  const next = title ? texts[texts.indexOf(title) + 1] : undefined;
  const subtitle =
    next &&
    !next.bullet &&
    next.el.textBold !== true &&
    isWords(next.el.label) &&
    sizeOf(next.el) < sizeOf(title!.el)
      ? next
      : undefined;
  let bullets = 0;
  let body = 0;
  return texts.map((t) => {
    const slot = !isWords(t.el.label)
      ? null
      : t === title
        ? 'title'
        : t === subtitle
          ? 'subtitle'
          : t.bullet
            ? `bullets[${bullets++}]`
            : `body[${body++}]`;
    return { id: t.el.id, slot };
  });
}

/** The slots in words, for a refusal or a listing: `title, subtitle, bullets ×5, body ×2`. */
export function slotsInWords(slots: readonly LayoutTextSlot[]): string {
  const count = (name: LayoutSlotName) =>
    slots.filter((s) => s.slot === name || s.slot?.startsWith(`${name}[`)).length;
  return LAYOUT_SLOT_NAMES.flatMap((name) => {
    const n = count(name);
    if (n === 0) return [];
    return name === 'title' || name === 'subtitle' ? [name] : [`${name} ×${n}`];
  }).join(', ');
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The layout's elements with the given text in its slots, and a line for anything the slots could not hold: a list
 * given more items than the layout has (the rest are not placed), a slot the layout has none of, and body texts left
 * holding their sample. Bullets given fewer than the layout has lose the rest, each with its dot. `relabel` sets one
 * element's words (a product fits a headline's type to them). `slots` are the texts left, read from the layout as
 * built (its sample), so a figure written into a body slot keeps that slot.
 */
export function fillLayoutSlots<E extends SlotElement>(
  elements: readonly E[],
  text: LayoutText,
  sizeOf: (el: SlotElement) => number,
  relabel: (el: E, label: string, slot: string) => E,
): { elements: E[]; lines: string[]; slots: LayoutTextSlot[] } {
  const slots = layoutSlots(elements, sizeOf);
  const idOf = (slot: string) => slots.find((s) => s.slot === slot)?.id;
  const words = new Map<string, string>();
  const dropped = new Set<string>();
  const lines: string[] = [];
  const single = (name: 'title' | 'subtitle') => {
    const given = text[name];
    if (given === undefined) return;
    const id = idOf(name);
    if (id) words.set(id, given);
    else lines.push(`This layout has no ${name}, so "${given}" was not placed.`);
  };
  single('title');
  single('subtitle');
  const list = (name: 'bullets' | 'body') => {
    const given = text[name];
    if (given === undefined) return;
    const ids = slots.filter((s) => s.slot?.startsWith(`${name}[`)).map((s) => s.id);
    given.slice(0, ids.length).forEach((g, i) => words.set(ids[i]!, g));
    if (given.length > ids.length)
      lines.push(
        ids.length === 0
          ? `This layout has no ${name}, so ${plural(given.length, 'item given was', 'items given were')} not placed.`
          : `${plural(given.length, `${name} item`, `${name} items`)} given, and the layout holds ${ids.length}: the last ${plural(given.length - ids.length, 'was', 'were')} not placed.`,
      );
    else if (given.length < ids.length) {
      const rest = ids.slice(given.length);
      if (name === 'bullets') {
        for (const id of rest) dropped.add(id);
        lines.push(
          `Removed the layout's ${plural(rest.length, 'unused bullet', 'unused bullets')}.`,
        );
      } else
        lines.push(
          `${plural(rest.length, 'body text keeps', 'body texts keep')} the layout's sample: change ${rest.length === 1 ? 'it' : 'them'} by ref (the page's texts list each).`,
        );
    }
  };
  list('bullets');
  list('body');
  const out: E[] = [];
  elements.forEach((el, i) => {
    if (dropped.has(el.id)) return;
    // A removed bullet's dot goes with it.
    const after = elements[i + 1];
    if (after && dropped.has(after.id) && isBulletDot(el, after)) return;
    const label = words.get(el.id);
    // Only a slot's element is given words, so the slot is there.
    out.push(
      label === undefined ? el : relabel(el, label, slots.find((s) => s.id === el.id)!.slot!),
    );
  });
  return { elements: out, lines, slots: slots.filter((s) => !dropped.has(s.id)) };
}

/** A change's `text` read from the wire: the slots, or why not in words. */
export function readLayoutText(v: unknown): LayoutText | { refused: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return { refused: '"text" is an object of slots: title, subtitle, bullets, body.' };
  const out: LayoutText = {};
  for (const [key, value] of Object.entries(v)) {
    if (!(LAYOUT_SLOT_NAMES as readonly string[]).includes(key))
      return {
        refused: `"text" takes no "${key}" (it takes ${LAYOUT_SLOT_NAMES.join(', ')}).`,
      };
    if (key === 'title' || key === 'subtitle') {
      if (typeof value !== 'string' || value.length > LAYOUT_TEXT_MAX)
        return { refused: `"text.${key}" is text of at most ${LAYOUT_TEXT_MAX} characters.` };
      out[key] = value;
      continue;
    }
    if (
      !Array.isArray(value) ||
      value.length > LAYOUT_SLOT_ITEMS_MAX ||
      value.some((item) => typeof item !== 'string' || item.length > LAYOUT_TEXT_MAX)
    )
      return {
        refused: `"text.${key}" is a list of at most ${LAYOUT_SLOT_ITEMS_MAX} texts, each at most ${LAYOUT_TEXT_MAX} characters.`,
      };
    out[key as 'bullets' | 'body'] = value as string[];
  }
  return out;
}
