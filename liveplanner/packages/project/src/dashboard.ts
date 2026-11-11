// A Dashboard tab's layout (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): rows of slots, each slot a span of
// the row's twelfths holding one thing or nothing. Pure: every change returns a new layout (the same one when nothing
// changes), always within the limits, so a stored or forged layout is normalised on read and never trusted as is.
import { readDashboardCard } from './dashboard-cards';
import { isDashboardStyledType, readDashboardCardStyle } from './dashboard-card-style';
import { isNamedSlotType, readSlotName } from './slot-name';
import {
  DASHBOARD_NOTE_MAX,
  DASHBOARD_NOTE_TITLE_MAX,
  DASHBOARD_ROWS_MAX,
  DASHBOARD_ROW_H_DEFAULT,
  DASHBOARD_ROW_H_MAX,
  DASHBOARD_ROW_H_MIN,
  DASHBOARD_SLOTS_MAX,
  type DashboardBackground,
  type DashboardContent,
  type DashboardLayout,
  type DashboardRow,
  type DashboardTabOf,
  type IdMaker,
  TAB_OFS,
  clamp,
  fitSpans,
  newDashboard,
  uniqueIds,
} from './dashboard-model';

export {
  DASHBOARD_BACKGROUNDS,
  DASHBOARD_GAP_PX,
  DASHBOARD_NOTE_MAX,
  DASHBOARD_NOTE_TITLE_MAX,
  DASHBOARD_ROWS_MAX,
  DASHBOARD_ROW_H_DEFAULT,
  DASHBOARD_ROW_H_MAX,
  DASHBOARD_ROW_H_MIN,
  DASHBOARD_SLOTS_MAX,
  DASHBOARD_SPANS,
  DASHBOARD_SPAN_MIN,
  dashboardRowsOf,
  evenSpans,
  newDashboard,
} from './dashboard-model';
export type {
  DashboardBackground,
  DashboardContent,
  DashboardLayout,
  DashboardRow,
  DashboardSlot,
  DashboardTabOf,
} from './dashboard-model';
export {
  addDashboardRow,
  addDashboardSlot,
  dashboardNeighbour,
  dashboardReadingNeighbour,
  insertDashboardRow,
  insertDashboardSlot,
  moveDashboardDivider,
  moveDashboardSlot,
  placeDashboardDuplicate,
  removeDashboardSlot,
  setDashboardContent,
  setDashboardRowHeight,
} from './dashboard-edits';

function readContent(v: unknown): DashboardContent | undefined {
  const content = readNamedContent(v);
  if (!content || !isDashboardStyledType(content.type)) return content;
  const style = readDashboardCardStyle((v as { style?: unknown }).style, content.type);
  return style ? ({ ...content, style } as DashboardContent) : content;
}

function readNamedContent(v: unknown): DashboardContent | undefined {
  const content = readBareContent(v);
  if (!content || !isNamedSlotType(content.type)) return content;
  const name = readSlotName((v as { name?: unknown }).name);
  return name ? ({ ...content, name } as DashboardContent) : content;
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
    return next && next !== content.elementId ? { ...content, elementId: next } : content;
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
