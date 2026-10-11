// A Dashboard tab's layout (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): rows of slots, each slot a span of
// the row's twelfths holding one thing or nothing. Pure: every change returns a new layout (the same one when nothing
// changes), always within the limits, so a stored or forged layout is normalised on read and never trusted as is.

import { readDashboardCard, type DashboardCardContent } from './dashboard-cards';
import {
  isDashboardStyledType,
  readDashboardCardStyle,
  type DashboardCardStyle,
} from './dashboard-card-style';

export const DASHBOARD_ROWS_MAX = 12;
export const DASHBOARD_SLOTS_MAX = 4;
// A row's width in spans, and the narrowest a slot may be.
export const DASHBOARD_SPANS = 12;
export const DASHBOARD_SPAN_MIN = 2;
export const DASHBOARD_ROW_H_MIN = 120;
export const DASHBOARD_ROW_H_MAX = 1200;
export const DASHBOARD_ROW_H_DEFAULT = 320;
// A note's text, and its heading.
export const DASHBOARD_NOTE_MAX = 2000;
export const DASHBOARD_NOTE_TITLE_MAX = 120;

export type DashboardContent =
  // A Board, Sheet or Diagram tab of the document, drawn compact and live.
  // `of`: which it is, so a slot whose tab was deleted can still say what was lost.
  | { type: 'tab'; tabId: string; of?: DashboardTabOf }
  // An element on the dashboard tab: a plan view (visualisation or metric) or a chart from a Sheet.
  | { type: 'element'; elementId: string }
  | { type: 'note'; title: string; text: string; style?: DashboardCardStyle }
  // A section's title: a big heading over a line or two of description, drawn bare on the page.
  | { type: 'title'; title: string; text: string; style?: DashboardCardStyle }
  // A Status, Checklist, Key Date or Links (dashboard-cards.ts).
  | DashboardCardContent;

// What kind of tab a slot shows: a Board or Sheet tab (worked on in place) or a Diagram tab (any other tab but a
// Dashboard: its drawing, live, still).
export type DashboardTabOf = 'board' | 'sheet' | 'diagram';
const TAB_OFS: readonly unknown[] = ['board', 'sheet', 'diagram'];

export type DashboardSlot = { id: string; span: number; content?: DashboardContent };
// `fill`: the row takes the page's height (a full-screen visualisation, docs/specs/026-plan/plan-tabs.md "A row that
// fills the page"); its `height` is kept for when it stops filling.
export type DashboardRow = { id: string; height: number; slots: DashboardSlot[]; fill?: true };
// `background`: the page behind the slots (docs/specs/026-plan/plan-tabs.md "Dashboard Settings"): plain (absent)
// or a soft tint of the theme's brand.
export const DASHBOARD_BACKGROUNDS = ['plain', 'tint'] as const;
export type DashboardBackground = (typeof DASHBOARD_BACKGROUNDS)[number];
export type DashboardLayout = { rows: DashboardRow[]; background?: 'tint' };

export type IdMaker = () => string;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Spans for `n` slots across a row: as even as twelfths allow, the remainder to the first slots.
export function evenSpans(n: number): number[] {
  const count = clamp(Math.round(n), 1, DASHBOARD_SLOTS_MAX);
  const base = Math.floor(DASHBOARD_SPANS / count);
  const extra = DASHBOARD_SPANS - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

function newRow(id: IdMaker, slots = 2): DashboardRow {
  return {
    id: id(),
    height: DASHBOARD_ROW_H_DEFAULT,
    slots: evenSpans(slots).map((span) => ({ id: id(), span })),
  };
}

// A new Dashboard: two rows of two empty slots.
export function newDashboard(id: IdMaker): DashboardLayout {
  return { rows: [newRow(id), newRow(id)] };
}

// A stored slot's content, a Utility keeping its style (dashboard-card-style.ts).
function readContent(v: unknown): DashboardContent | undefined {
  const content = readBareContent(v);
  if (!content || !isDashboardStyledType(content.type)) return content;
  const style = readDashboardCardStyle((v as { style?: unknown }).style, content.type);
  return style ? ({ ...content, style } as DashboardContent) : content;
}

function readBareContent(v: unknown): DashboardContent | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const c = v as Record<string, unknown>;
  if (c['type'] === 'tab' && typeof c['tabId'] === 'string')
    return {
      type: 'tab',
      tabId: c['tabId'],
      ...(TAB_OFS.includes(c['of']) ? { of: c['of'] as DashboardTabOf } : {}),
    };
  if (c['type'] === 'element' && typeof c['elementId'] === 'string')
    return { type: 'element', elementId: c['elementId'] };
  if (c['type'] === 'note' || c['type'] === 'title')
    return {
      type: c['type'],
      title: typeof c['title'] === 'string' ? c['title'].slice(0, DASHBOARD_NOTE_TITLE_MAX) : '',
      text: typeof c['text'] === 'string' ? c['text'].slice(0, DASHBOARD_NOTE_MAX) : '',
    };
  return readDashboardCard(c);
}

// Spans that fit a row: each at least the minimum, together exactly twelve (the last slot takes up the slack, or the
// widest give way), and at most as many slots as twelve allows at the minimum.
function fitSpans(spans: number[]): number[] {
  const out = spans.map((s) =>
    clamp(Math.round(Number.isFinite(s) ? s : 0), DASHBOARD_SPAN_MIN, DASHBOARD_SPANS),
  );
  let total = out.reduce((a, b) => a + b, 0);
  while (total > DASHBOARD_SPANS) {
    const i = out.indexOf(Math.max(...out));
    out[i]! -= 1;
    total -= 1;
  }
  if (total < DASHBOARD_SPANS) out[out.length - 1]! += DASHBOARD_SPANS - total;
  return out;
}

// Ids made unique as they are read: the first of a kind keeps its id, a repeat takes its id plus the next free
// `~n` (so the same stored layout always reads the same).
function uniqueIds(): (id: string) => string {
  const seen = new Set<string>();
  return (id) => {
    let out = id;
    for (let n = 2; seen.has(out); n += 1) out = `${id}~${n}`;
    seen.add(out);
    return out;
  };
}

// A stored layout, read safely: unknown fields dropped, rows and slots within their limits, spans fitting, heights
// clamped, ids unique. Null for anything that is not a layout.
export function readDashboard(v: unknown): DashboardLayout | null {
  if (!v || typeof v !== 'object' || !Array.isArray((v as { rows?: unknown }).rows)) return null;
  const rows: DashboardRow[] = [];
  // Every row and slot id is the layout's own once: a repeat (a hand-edited or forged file) takes a fresh one.
  const unique = uniqueIds();
  for (const r of (v as { rows: unknown[] }).rows.slice(0, DASHBOARD_ROWS_MAX)) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    if (typeof row['id'] !== 'string' || !Array.isArray(row['slots'])) continue;
    const slots = (row['slots'] as unknown[])
      .filter(
        (s): s is Record<string, unknown> =>
          !!s && typeof s === 'object' && typeof (s as { id?: unknown }).id === 'string',
      )
      .slice(0, DASHBOARD_SLOTS_MAX);
    if (slots.length === 0) continue;
    const spans = fitSpans(slots.map((s) => (typeof s['span'] === 'number' ? s['span'] : 0)));
    rows.push({
      id: unique(row['id']),
      height: clamp(
        typeof row['height'] === 'number' && Number.isFinite(row['height'])
          ? Math.round(row['height'])
          : DASHBOARD_ROW_H_DEFAULT,
        DASHBOARD_ROW_H_MIN,
        DASHBOARD_ROW_H_MAX,
      ),
      slots: slots.map((s, i) => {
        const content = readContent(s['content']);
        return { id: unique(s['id'] as string), span: spans[i]!, ...(content ? { content } : {}) };
      }),
      ...(row['fill'] === true ? { fill: true as const } : {}),
    });
  }
  const background = (v as { background?: unknown }).background === 'tint' ? 'tint' : undefined;
  return background ? { rows, background } : { rows };
}

const mapRow = (
  layout: DashboardLayout,
  rowId: string,
  f: (row: DashboardRow) => DashboardRow | null,
): DashboardLayout => {
  let changed = false;
  const rows: DashboardRow[] = [];
  for (const row of layout.rows) {
    if (row.id !== rowId) {
      rows.push(row);
      continue;
    }
    const next = f(row);
    if (next !== row) changed = true;
    if (next) rows.push(next);
  }
  return changed ? { ...layout, rows } : layout;
};

// A row of two empty slots after `afterRowId` (at the end when absent); the same layout at the row limit.
export function addDashboardRow(
  layout: DashboardLayout,
  id: IdMaker,
  afterRowId?: string,
): DashboardLayout {
  if (layout.rows.length >= DASHBOARD_ROWS_MAX) return layout;
  const at = afterRowId ? layout.rows.findIndex((r) => r.id === afterRowId) : -1;
  const rows = [...layout.rows];
  rows.splice(at < 0 ? rows.length : at + 1, 0, newRow(id));
  return { ...layout, rows };
}

// A row's height, clamped.
export function setDashboardRowHeight(
  layout: DashboardLayout,
  rowId: string,
  height: number,
): DashboardLayout {
  const h = clamp(Math.round(height), DASHBOARD_ROW_H_MIN, DASHBOARD_ROW_H_MAX);
  return mapRow(layout, rowId, (row) => (row.height === h ? row : { ...row, height: h }));
}

// An empty slot added to a row: the widest slot splits (its right half becomes the new one, after it). The same
// layout at the slot limit, or when no slot is wide enough to split.
export function addDashboardSlot(
  layout: DashboardLayout,
  rowId: string,
  id: IdMaker,
): DashboardLayout {
  return mapRow(layout, rowId, (row) => {
    if (row.slots.length >= DASHBOARD_SLOTS_MAX) return row;
    const widest = row.slots.reduce((w, s, i) => (s.span > row.slots[w]!.span ? i : w), 0);
    const span = row.slots[widest]!.span;
    if (span < DASHBOARD_SPAN_MIN * 2) return row;
    const right = Math.floor(span / 2);
    const slots = [...row.slots];
    slots.splice(
      widest,
      1,
      { ...row.slots[widest]!, span: span - right },
      { id: id(), span: right },
    );
    return { ...row, slots };
  });
}

// An empty slot put at `index` in a row (0 is the left end, the slot count the right end): it takes half the span of
// the wider slot beside it there. The same layout at the slot limit, or when that neighbour is too narrow to share.
export function insertDashboardSlot(
  layout: DashboardLayout,
  rowId: string,
  index: number,
  id: IdMaker,
): DashboardLayout {
  return mapRow(layout, rowId, (row) => {
    if (row.slots.length >= DASHBOARD_SLOTS_MAX) return row;
    const at = clamp(Math.round(index), 0, row.slots.length);
    const left = row.slots[at - 1];
    const right = row.slots[at];
    const donor = !left ? at : !right ? at - 1 : left.span >= right.span ? at - 1 : at;
    const span = row.slots[donor]!.span;
    if (span < DASHBOARD_SPAN_MIN * 2) return row;
    const given = Math.floor(span / 2);
    const slots = row.slots.map((s, i) => (i === donor ? { ...s, span: span - given } : s));
    slots.splice(at, 0, { id: id(), span: given });
    return { ...row, slots };
  });
}

// A row of `slots` empty slots and `height` put at `index` among the rows (0 the top). The same layout at the row limit.
export function insertDashboardRow(
  layout: DashboardLayout,
  index: number,
  height: number,
  slots: number,
  id: IdMaker,
): DashboardLayout {
  if (layout.rows.length >= DASHBOARD_ROWS_MAX) return layout;
  const rows = [...layout.rows];
  rows.splice(clamp(Math.round(index), 0, rows.length), 0, {
    id: id(),
    height: clamp(Math.round(height), DASHBOARD_ROW_H_MIN, DASHBOARD_ROW_H_MAX),
    slots: evenSpans(slots).map((span) => ({ id: id(), span })),
  });
  return { ...layout, rows };
}

// A slot removed: its span goes to its left neighbour (its right one when first); the last slot removes its row.
export function removeDashboardSlot(
  layout: DashboardLayout,
  rowId: string,
  slotId: string,
): DashboardLayout {
  return mapRow(layout, rowId, (row) => {
    const i = row.slots.findIndex((s) => s.id === slotId);
    if (i < 0) return row;
    if (row.slots.length === 1) return null;
    const gone = row.slots[i]!;
    const n = i > 0 ? i - 1 : 1;
    const slots = row.slots.map((s, j) => (j === n ? { ...s, span: s.span + gone.span } : s));
    slots.splice(i, 1);
    return { ...row, slots };
  });
}

// The divider after slot `index` moved by `delta` spans: the slot on its left grows by it and the one on its right
// shrinks, each kept at least the minimum. The same layout when nothing moves.
export function moveDashboardDivider(
  layout: DashboardLayout,
  rowId: string,
  index: number,
  delta: number,
): DashboardLayout {
  return mapRow(layout, rowId, (row) => {
    const left = row.slots[index];
    const right = row.slots[index + 1];
    if (!left || !right) return row;
    const d = clamp(
      Math.round(delta),
      DASHBOARD_SPAN_MIN - left.span,
      right.span - DASHBOARD_SPAN_MIN,
    );
    if (d === 0) return row;
    const slots = [...row.slots];
    slots[index] = { ...left, span: left.span + d };
    slots[index + 1] = { ...right, span: right.span - d };
    return { ...row, slots };
  });
}

// A slot's content set, or cleared (undefined).
export function setDashboardContent(
  layout: DashboardLayout,
  slotId: string,
  content: DashboardContent | undefined,
): DashboardLayout {
  const row = layout.rows.find((r) => r.slots.some((s) => s.id === slotId));
  if (!row) return layout;
  return mapRow(layout, row.id, (r) => ({
    ...r,
    slots: r.slots.map((s) => {
      if (s.id !== slotId) return s;
      const { content: _drop, ...rest } = s;
      return content ? { ...rest, content } : rest;
    }),
  }));
}

// The slot beside `slotId` in direction `dir`, for moving it from the keyboard: left and right its neighbours in its
// row; up and down the slot in the row above or below whose middle (by span) is nearest its own. Null at an edge.
export function dashboardNeighbour(
  layout: DashboardLayout,
  slotId: string,
  dir: 'left' | 'right' | 'up' | 'down',
): string | null {
  const r = layout.rows.findIndex((row) => row.slots.some((s) => s.id === slotId));
  if (r < 0) return null;
  const row = layout.rows[r]!;
  const i = row.slots.findIndex((s) => s.id === slotId);
  if (dir === 'left') return row.slots[i - 1]?.id ?? null;
  if (dir === 'right') return row.slots[i + 1]?.id ?? null;
  const other = layout.rows[dir === 'up' ? r - 1 : r + 1];
  if (!other) return null;
  const middles = (slots: readonly DashboardSlot[]) => {
    let at = 0;
    return slots.map((s) => {
      const mid = at + s.span / 2;
      at += s.span;
      return mid;
    });
  };
  const mine = middles(row.slots)[i]!;
  const theirs = middles(other.slots);
  let best = 0;
  for (const [k, m] of theirs.entries())
    if (Math.abs(m - mine) < Math.abs(theirs[best]! - mine)) best = k;
  return other.slots[best]?.id ?? null;
}

// Where a moved slot goes (DashboardPage's drag): onto another slot (the two swap what they hold; spans stay), into a
// gap in a row (`index`, 0 its left end), or between rows as a row of its own (`index`, 0 above the first).
export type DashboardMoveTarget =
  | { kind: 'slot'; slotId: string }
  | { kind: 'slot-gap'; rowId: string; index: number }
  | { kind: 'row-gap'; index: number };

// The slot `slotId` moved to `target`. Leaving its row gives its span to its neighbour (the row goes with its last
// slot); joining a row takes half the wider neighbour's span there. The same layout when the move changes nothing or
// cannot be made (the target row is full, or too narrow to share, or a new row would pass the row limit).
export function moveDashboardSlot(
  layout: DashboardLayout,
  slotId: string,
  target: DashboardMoveTarget,
  id: IdMaker,
): DashboardLayout {
  const fromRow = layout.rows.find((r) => r.slots.some((s) => s.id === slotId));
  const slot = fromRow?.slots.find((s) => s.id === slotId);
  if (!fromRow || !slot) return layout;
  if (target.kind === 'slot') {
    if (target.slotId === slotId) return layout;
    const other = layout.rows.flatMap((r) => r.slots).find((s) => s.id === target.slotId);
    if (!other) return layout;
    const swapped = setDashboardContent(
      setDashboardContent(layout, slotId, other.content),
      target.slotId,
      slot.content,
    );
    return swapped;
  }
  const fromIndex = fromRow.slots.findIndex((s) => s.id === slotId);
  if (target.kind === 'slot-gap' && target.rowId === fromRow.id) {
    // Within its own row: the slot (span and all) moves to the gap.
    const to = target.index > fromIndex ? target.index - 1 : target.index;
    if (to === fromIndex) return layout;
    return mapRow(layout, fromRow.id, (row) => {
      const slots = row.slots.filter((s) => s.id !== slotId);
      slots.splice(to, 0, slot);
      return { ...row, slots };
    });
  }
  if (target.kind === 'slot-gap') {
    const toRow = layout.rows.find((r) => r.id === target.rowId);
    if (!toRow || toRow.slots.length >= DASHBOARD_SLOTS_MAX) return layout;
    const opened = insertDashboardSlot(layout, toRow.id, target.index, () => slot.id + ':moving');
    if (opened === layout) return layout;
    const left = removeDashboardSlot(opened, fromRow.id, slotId);
    return mapRow(left, toRow.id, (row) => ({
      ...row,
      slots: row.slots.map((s) =>
        s.id === slot.id + ':moving'
          ? { id: slot.id, span: s.span, ...(slot.content ? { content: slot.content } : {}) }
          : s,
      ),
    }));
  }
  // A row of its own: as wide as the page, at its height, where the gap is (counted before the source row may go).
  if (fromRow.slots.length === 1) {
    const at = layout.rows.indexOf(fromRow);
    if (target.index === at || target.index === at + 1) return layout;
  } else if (layout.rows.length >= DASHBOARD_ROWS_MAX) {
    // Its row stays, so the new one would be a row past the limit (which a read drops, orphaning its content).
    return layout;
  }
  const rows = [...layout.rows];
  rows.splice(clamp(Math.round(target.index), 0, rows.length), 0, {
    id: id(),
    height: fromRow.height,
    slots: [{ id: slot.id + ':moving', span: DASHBOARD_SPANS }],
  });
  const left = removeDashboardSlot({ ...layout, rows }, fromRow.id, slotId);
  return {
    ...layout,
    rows: left.rows.map((r) => ({
      ...r,
      slots: r.slots.map((s) =>
        s.id === slot.id + ':moving'
          ? { id: slot.id, span: s.span, ...(slot.content ? { content: slot.content } : {}) }
          : s,
      ),
    })),
  };
}

// The element ids the layout's slots hold.
export function dashboardElementIds(layout: DashboardLayout): Set<string> {
  const ids = new Set<string>();
  for (const row of layout.rows)
    for (const s of row.slots) if (s.content?.type === 'element') ids.add(s.content.elementId);
  return ids;
}

// A slot's content once its elements and Sheets have new ids (remapDashboardElements); the same content when neither
// changes it.
function remappedContent(
  content: DashboardContent,
  ids: ReadonlyMap<string, string>,
  sheetIds: ReadonlyMap<string, string>,
): DashboardContent {
  if (content.type === 'element') {
    const next = ids.get(content.elementId);
    return next && next !== content.elementId ? { type: 'element', elementId: next } : content;
  }
  if (content.type === 'sheet-metric') {
    const next = sheetIds.get(content.sheetId);
    return next && next !== content.sheetId ? { ...content, sheetId: next } : content;
  }
  return content;
}

// The layout once its elements have new ids (a duplicated or imported Dashboard, whose elements are re-minted): each
// element slot names its element's new id, and each figure from a Sheet the new id of the Sheet copied with it
// (`sheetIds`, old to new); a slot whose element or Sheet has none is left as it is. The same layout when nothing
// changes.
export function remapDashboardElements(
  layout: DashboardLayout,
  ids: ReadonlyMap<string, string>,
  sheetIds: ReadonlyMap<string, string> = new Map(),
): DashboardLayout {
  let changed = false;
  const rows = layout.rows.map((row) => {
    let rowChanged = false;
    const slots = row.slots.map((s) => {
      if (!s.content) return s;
      const content = remappedContent(s.content, ids, sheetIds);
      if (content === s.content) return s;
      rowChanged = true;
      return { ...s, content };
    });
    if (!rowChanged) return row;
    changed = true;
    return { ...row, slots };
  });
  return changed ? { ...layout, rows } : layout;
}

// The layout with every row and slot under a new id (a duplicated or imported Dashboard: its ids are its own, never
// shared with the layout it came from).
export function remintDashboardIds(layout: DashboardLayout, id: IdMaker): DashboardLayout {
  return {
    ...layout,
    rows: layout.rows.map((row) => ({
      ...row,
      id: id(),
      slots: row.slots.map((s) => ({ ...s, id: id() })),
    })),
  };
}

// The layouts a new Dashboard can start from (docs/specs/026-plan/plan-tabs.md "Dashboard tab"), each its rows'
// heights and spans, empty: the slots are filled from the palette, and everything can be changed after.
export const DASHBOARD_PRESETS = [
  {
    id: 'two-by-two',
    name: 'Two by Two',
    line: 'Four even slots.',
    rows: [
      [320, [6, 6]],
      [320, [6, 6]],
    ],
  },
  {
    id: 'overview',
    name: 'Overview',
    line: 'A row of metrics over two charts.',
    rows: [
      [160, [3, 3, 3, 3]],
      [360, [6, 6]],
    ],
  },
  {
    id: 'focus',
    name: 'Focus',
    line: 'One wide board with a side column.',
    rows: [[730, [8, 4]]],
  },
  {
    id: 'three-columns',
    name: 'Three Columns',
    line: 'Three slots side by side, twice.',
    rows: [
      [320, [4, 4, 4]],
      [320, [4, 4, 4]],
    ],
  },
  {
    id: 'stacked',
    name: 'Stacked',
    line: 'Full-width rows, one under another.',
    rows: [
      [200, [12]],
      [360, [12]],
      [360, [12]],
    ],
  },
  {
    id: 'report',
    name: 'Report',
    line: 'Metrics, a wide chart, then two side by side.',
    rows: [
      [160, [4, 4, 4]],
      [360, [12]],
      [320, [6, 6]],
    ],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  line: string;
  rows: readonly (readonly [number, readonly number[]])[];
}[];

export type DashboardPresetId = (typeof DASHBOARD_PRESETS)[number]['id'];

// A new Dashboard from a preset (the default, Two by Two, for an unknown one), read through readDashboard so it is
// within the limits.
export function dashboardFromPreset(presetId: string | undefined, id: IdMaker): DashboardLayout {
  const preset = DASHBOARD_PRESETS.find((p) => p.id === presetId) ?? DASHBOARD_PRESETS[0];
  return (
    readDashboard({
      rows: preset.rows.map(([height, spans]) => ({
        id: id(),
        height,
        slots: spans.map((span) => ({ id: id(), span })),
      })),
    }) ?? newDashboard(id)
  );
}

// The page behind the slots set; the same layout when it already is.
export function setDashboardBackground(
  layout: DashboardLayout,
  background: DashboardBackground,
): DashboardLayout {
  if ((layout.background ?? 'plain') === background) return layout;
  if (background === 'tint') return { ...layout, background };
  const { background: _plain, ...rest } = layout;
  return rest;
}

// Every slot emptied, the rows and their spans kept (Clear Dashboard); the same layout when nothing holds anything.
export function clearDashboard(layout: DashboardLayout): DashboardLayout {
  if (!layout.rows.some((r) => r.slots.some((s) => s.content))) return layout;
  return {
    ...layout,
    rows: layout.rows.map((r) => ({
      ...r,
      slots: r.slots.map((s) => ({ id: s.id, span: s.span })),
    })),
  };
}

// A preset's rows in place of the layout's (Start Over From a Layout), its background kept.
export function relayoutDashboard(
  layout: DashboardLayout,
  presetId: string,
  id: IdMaker,
): DashboardLayout {
  const next = dashboardFromPreset(presetId, id);
  return layout.background ? { ...next, background: layout.background } : next;
}
