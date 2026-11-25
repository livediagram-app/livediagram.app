// A page layout's text slots (each paged product's docs/specs/024-agents/pages-for-agents.md "Text slots"): the
// names a change_pages call fills a layout's sample text by, so a deck or a set of screens is laid out and written in
// one call rather than laid out, read back and rewritten by ref. Slots are read from the built layout, never
// hand-marked on it, so every layout has them and a new one needs nothing: the headline (the largest words) is
// `title`, the line straight under it `subtitle`, each line set beside a bullet dot one of `bullets`, and every other
// text one of `body`, in the order the layout builds them (top to bottom, then the next column). A figure (a text with
// no letter, or a number with a unit or two: a time, "73%", "3.2M", a quote mark) is one of `figures`, in the same
// order, so a stat slide's big numbers are written in the same change as its words. A compound element's own words (a
// stat row's values and captions, a process's steps, a checklist's rows, a concept graphic's or timeline's rows and
// notes) are slots too, each part in its place in that order (`<id>#<n>`), so a Key Stats or Process layout is
// written in the one change rather than left holding its sample numbers.

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

export const LAYOUT_SLOT_NAMES = [
  'title',
  'subtitle',
  'bullets',
  'body',
  'figures',
  'table',
] as const;
export type LayoutSlotName = (typeof LAYOUT_SLOT_NAMES)[number];

/** What a change gives a layout's slots: a slot left out keeps the layout's sample. */
export type LayoutText = {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  body?: string[];
  figures?: string[];
  // The layout's first table, every row at once (its header row first): a pricing or comparison slide's cells.
  table?: string[][];
};

// The longest text one slot takes, and the most items a list slot takes (the fullest layout has 40 texts).
export const LAYOUT_TEXT_MAX = 2000;
export const LAYOUT_SLOT_ITEMS_MAX = 60;
// The most columns a table slot takes.
export const LAYOUT_TABLE_COLUMNS_MAX = 12;

/** One text of a laid-out page: its element, its slot (`title`, `bullets[2]`, `figures[0]`), and `sample` when it
 *  still holds the layout's sample text. */
export type LayoutTextSlot = { id: string; slot: string | null; sample?: true };

// ---------- A compound element's parts

// The content fields a part is read from, the same name on every product's element.
type PartField =
  | { field: 'stats'; key: 'value' | 'caption' }
  | { field: 'processSteps' }
  | { field: 'checklistItems'; key: 'text' }
  | { field: 'conceptRows'; key: 'label' | 'note' };

type PartAt = PartField & { index: number };

/** Where one part of a compound element is kept: `stats[0].value`, `processSteps[2]`. */
export function partPath(at: PartAt): string {
  return 'key' in at ? `${at.field}[${at.index}].${at.key}` : `${at.field}[${at.index}]`;
}

const rowsOf = (el: SlotElement, field: string): unknown[] => {
  const v = (el as Record<string, unknown>)[field];
  return Array.isArray(v) ? v : [];
};

/** A compound element's words, in reading order, each with where it is kept. Empty for any other element. */
export function partsOf(el: SlotElement): { at: PartAt; text: string }[] {
  const out: { at: PartAt; text: string }[] = [];
  const keyed = (field: 'stats' | 'checklistItems' | 'conceptRows', keys: readonly string[]) =>
    rowsOf(el, field).forEach((row, index) => {
      if (!row || typeof row !== 'object') return;
      for (const key of keys) {
        const text = (row as Record<string, unknown>)[key];
        if (typeof text === 'string' && text.trim() !== '')
          out.push({ at: { field, key, index } as PartAt, text });
      }
    });
  keyed('stats', ['value', 'caption']);
  rowsOf(el, 'processSteps').forEach((text, index) => {
    if (typeof text === 'string' && text.trim() !== '')
      out.push({ at: { field: 'processSteps', index }, text });
  });
  keyed('checklistItems', ['text']);
  keyed('conceptRows', ['label', 'note']);
  return out;
}

/** The element with the parts given written in, each by where it is kept. */
function withParts<E extends SlotElement>(
  el: E,
  words: readonly { at: PartAt; text: string }[],
): E {
  const next = { ...el } as Record<string, unknown>;
  for (const { at, text } of words) {
    const rows = [...rowsOf(next as SlotElement, at.field)];
    rows[at.index] = 'key' in at ? { ...(rows[at.index] as object), [at.key]: text } : text;
    next[at.field] = rows;
  }
  return next as E;
}

/** A part's slot id: its element's id and its place among the element's parts. */
export const partId = (id: string, n: number) => `${id}#${n}`;

// A table's fields the table slot keeps in step with its cells: each product's table element has them.
type TableLike = SlotElement & {
  cells: string[][];
  cellStyles?: unknown[][];
  colWidths?: (number | null)[];
  rowHeights?: (number | null)[];
  highlightColumn?: number;
};

/** A table's words in a line, for the answer: its header row. */
export function tableInWords(el: SlotElement): string | null {
  const cells = (el as Partial<TableLike>).cells;
  return Array.isArray(cells) && Array.isArray(cells[0]) ? cells[0].join(' | ') : null;
}

/**
 * The table with the rows given as its cells, every row as long as the longest. A size it had stays where it still
 * fits: a cell's own style and the first column's width are kept, the recommended column while it is still there, and
 * rows' heights are left to the new words.
 */
function withTable<E extends SlotElement>(el: E, rows: readonly (readonly string[])[]): E {
  const t = el as unknown as TableLike;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const cells = rows.map((r) => Array.from({ length: cols }, (_, c) => r[c] ?? ''));
  const next: TableLike = { ...t, cells };
  if (t.cellStyles)
    next.cellStyles = cells.map((r, ri) =>
      r.map((_, c) => t.cellStyles?.[Math.min(ri, t.cellStyles.length - 1)]?.[c] ?? null),
    );
  if (t.colWidths) {
    const same = t.colWidths.length === cols;
    next.colWidths = same
      ? t.colWidths
      : [t.colWidths[0] ?? null, ...Array.from({ length: cols - 1 }, () => null)];
  }
  if (t.rowHeights) delete next.rowHeights;
  if (typeof t.highlightColumn === 'number' && t.highlightColumn >= cols)
    delete next.highlightColumn;
  return next as unknown as E;
}

/** A slot id's element and part, or the element alone. */
export function splitPartId(id: string): { id: string; part: number | null } {
  const at = id.lastIndexOf('#');
  const n = at > 0 ? Number(id.slice(at + 1)) : NaN;
  return Number.isInteger(n) && n >= 0 ? { id: id.slice(0, at), part: n } : { id, part: null };
}

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
  type Text = { el: SlotElement & { label: string }; bullet: boolean; part: boolean };
  const texts: Text[] = elements.flatMap((el, i): Text[] => {
    const own: Text[] = isTexty(el)
      ? [{ el, bullet: isBulletDot(elements[i - 1], el), part: false }]
      : [];
    return [
      ...own,
      ...partsOf(el).map((p, n) => ({
        el: { id: partId(el.id, n), type: 'part', label: p.text },
        bullet: false,
        part: true,
      })),
    ];
  });
  // A part is never the headline or the line under it: those are a page's own texts.
  const worded = texts.filter((t) => !t.part && isWords(t.el.label));
  let title: (typeof worded)[number] | undefined;
  for (const t of worded) if (!title || sizeOf(t.el) > sizeOf(title.el)) title = t;
  const next = title ? texts[texts.indexOf(title) + 1] : undefined;
  const subtitle =
    next &&
    !next.bullet &&
    !next.part &&
    next.el.textBold !== true &&
    isWords(next.el.label) &&
    sizeOf(next.el) < sizeOf(title!.el)
      ? next
      : undefined;
  let bullets = 0;
  let body = 0;
  let figures = 0;
  const table = elements.find(
    (el) => el.type === 'table' && Array.isArray((el as TableLike).cells),
  );
  const tableSlot: LayoutTextSlot[] = table ? [{ id: table.id, slot: 'table' }] : [];
  return [
    ...tableSlot,
    ...texts.map((t) => {
      const slot = !isWords(t.el.label)
        ? `figures[${figures++}]`
        : t === title
          ? 'title'
          : t === subtitle
            ? 'subtitle'
            : t.bullet
              ? `bullets[${bullets++}]`
              : `body[${body++}]`;
      return { id: t.el.id, slot };
    }),
  ];
}

/** The slots in words, for a refusal or a listing: `title, subtitle, bullets ×5, body ×2`. */
export function slotsInWords(slots: readonly LayoutTextSlot[]): string {
  const count = (name: LayoutSlotName) =>
    slots.filter((s) => s.slot === name || s.slot?.startsWith(`${name}[`)).length;
  return LAYOUT_SLOT_NAMES.flatMap((name) => {
    const n = count(name);
    if (n === 0) return [];
    return name === 'title' || name === 'subtitle' || name === 'table' ? [name] : [`${name} ×${n}`];
  }).join(', ');
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The layout's elements with the given text in its slots, and a line for anything the slots could not hold: a list
 * given more items than the layout has (the rest are not placed), a slot the layout has none of, and body texts left
 * holding their sample. Bullets given fewer than the layout has lose the rest, each with its dot. `relabel` sets one
 * element's words (a product fits a headline's type to them). `slots` are the texts left, read from the layout as
 * built (its sample), so words written into a figure's slot keep that slot.
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
  const list = (name: 'bullets' | 'body' | 'figures') => {
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
          `${plural(rest.length, `${name === 'body' ? 'body text' : 'figure'} keeps`, `${name === 'body' ? 'body texts' : 'figures'} keep`)} the layout's sample: change ${rest.length === 1 ? 'it' : 'them'} by ref (the page's texts list each).`,
        );
    }
  };
  list('bullets');
  list('body');
  list('figures');
  let table: { id: string; rows: string[][] } | null = null;
  if (text.table !== undefined) {
    const id = idOf('table');
    if (id) table = { id, rows: text.table };
    else
      lines.push(
        `This layout has no table, so the ${plural(text.table.length, 'row given was', 'rows given were')} not placed.`,
      );
  }
  const out: E[] = [];
  elements.forEach((el, i) => {
    if (dropped.has(el.id)) return;
    // A removed bullet's dot goes with it.
    const after = elements[i + 1];
    if (after && dropped.has(after.id) && isBulletDot(el, after)) return;
    const label = words.get(el.id);
    // Only a slot's element is given words, so the slot is there.
    const labelled =
      label === undefined ? el : relabel(el, label, slots.find((s) => s.id === el.id)!.slot!);
    const written = partsOf(el).flatMap((p, n) => {
      const text = words.get(partId(el.id, n));
      return text === undefined ? [] : [{ at: p.at, text }];
    });
    const parted = written.length > 0 ? withParts(labelled, written) : labelled;
    out.push(table && table.id === el.id ? withTable(parted, table.rows) : parted);
  });
  // Sample words in a slot the change never named: said, so a page isn't shared still reading "Presenter name".
  const unnamed = slots.filter((s) => {
    if (!s.slot || dropped.has(s.id) || words.has(s.id) || s.slot === 'table') return false;
    const name = s.slot.replace(/\[\d+\]$/, '') as LayoutSlotName;
    return text[name] === undefined;
  });
  if (unnamed.length > 0) {
    const labelOf = (id: string) => {
      const { id: base, part } = splitPartId(id);
      const el = elements.find((e) => e.id === id) ?? elements.find((e) => e.id === base);
      const words = el && part !== null && el.id !== id ? partsOf(el)[part]?.text : el?.label;
      const t = typeof words === 'string' ? words : '';
      return t.length > 40 ? `${t.slice(0, 39)}…` : t;
    };
    lines.push(
      `Still the layout's sample: ${unnamed.map((s) => `${s.slot} "${labelOf(s.id)}"`).join(', ')}. Give ${unnamed.length === 1 ? 'it' : 'them'} in "text" by slot, or change ${unnamed.length === 1 ? 'it' : 'them'} by ref.`,
    );
  }
  return {
    elements: out,
    lines,
    slots: slots
      .filter((s) => !dropped.has(s.id))
      .map((s) =>
        words.has(s.id) || (table && s.id === table.id) ? s : { ...s, sample: true as const },
      ),
  };
}

/** A change's `text` read from the wire: the slots, or why not in words. */
export function readLayoutText(v: unknown): LayoutText | { refused: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return { refused: `"text" is an object of slots: ${LAYOUT_SLOT_NAMES.join(', ')}.` };
  const out: LayoutText = {};
  for (const [key, value] of Object.entries(v)) {
    if (!(LAYOUT_SLOT_NAMES as readonly string[]).includes(key))
      return {
        refused: `"text" takes no "${key}" (it takes ${LAYOUT_SLOT_NAMES.join(', ')}).`,
      };
    if (key === 'table') {
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.length > LAYOUT_SLOT_ITEMS_MAX ||
        value.some(
          (row) =>
            !Array.isArray(row) ||
            row.length > LAYOUT_TABLE_COLUMNS_MAX ||
            row.some((cell) => typeof cell !== 'string' || cell.length > LAYOUT_TEXT_MAX),
        )
      )
        return {
          refused: `"text.table" is a list of rows (the header row first), at most ${LAYOUT_SLOT_ITEMS_MAX}, each a list of at most ${LAYOUT_TABLE_COLUMNS_MAX} cells of text.`,
        };
      out.table = value as string[][];
      continue;
    }
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
    out[key as 'bullets' | 'body' | 'figures'] = value as string[];
  }
  return out;
}
