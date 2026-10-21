// The palette on a Dashboard tab (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): a plan view, board, Sheet or
// sticky (a note) tile fills a slot, and a Layout tile adds a row or a slot, rather than landing on the canvas the page
// covers. A module seam, as card-types-opener is: the open Dashboard registers where they go, and the editor's element
// creation hands a pressed tile to it while one is registered; a dragged tile is dropped on the page itself
// (DashboardPage), which works out the zone it lands in (dashboardZone).

import {
  DASHBOARD_CARD_TYPES,
  FORM_METRICS,
  SHEET_METRICS,
  type FormMetricKind,
  type DashboardTabOf,
  type ShapeElement,
  type SheetMetricKind,
} from '@livediagram/document';
import { fitsSlot } from './slot-fit';

export type DashboardItem =
  | { kind: 'view'; view: string }
  | { kind: 'board'; preset?: string | undefined }
  | { kind: 'sheet'; start?: string | undefined }
  | { kind: 'note' }
  // A card written on the page (palette-dashboard-tiles' Cards): a Title, Status, Checklist, Key Date or Links.
  | { kind: 'card'; card: DashboardCardKind }
  // A figure from a Sheet (Add to Slot's From a Sheet), its source chosen once placed.
  | { kind: 'sheet-metric'; metric: SheetMetricKind }
  // A figure from a form (Add to Slot's Form Metrics), the document's form chosen as it is placed.
  | { kind: 'form-metric'; metric: FormMetricKind }
  // A chart from a Sheet (Add to Slot's Sheet Chart): `chart` once chosen (SheetChartSource), the element it places.
  | { kind: 'sheet-chart'; chart?: ShapeElement | undefined }
  // An existing Board or Sheet tab, shown in a slot (the Tabs category).
  | { kind: 'tab'; tabId: string; of: DashboardTabOf }
  // The Layout tiles (palette-dashboard-tiles): a row of its height and slots, or a slot.
  | { kind: 'row'; height: number; slots: number }
  | { kind: 'slot' };

// Where a drop lands: into a slot, a new row at a gap between rows (`index`, 0 above the first), or a new slot at a gap
// in a row (`index`, 0 at its left end). Null: a press, which takes the defaults (placeItem).
export type DashboardZone =
  | { kind: 'slot'; slotId: string }
  | { kind: 'row-gap'; index: number }
  | { kind: 'slot-gap'; rowId: string; index: number };

type DashboardPlacer = (item: DashboardItem, zone: DashboardZone | null) => void;

let placer: DashboardPlacer | null = null;

// The open Dashboard's placer; returns the unregister.
export function registerDashboardPlacer(next: DashboardPlacer): () => void {
  placer = next;
  return () => {
    if (placer === next) placer = null;
  };
}

// Something pressed in the palette, on a Dashboard: true when the Dashboard took it.
export function placeOnDashboard(item: DashboardItem | null): boolean {
  if (!placer || !item) return false;
  placer(item, null);
  return true;
}

// A Dashboard is open: the palette's tiles fill its slots.
export function dashboardOpen(): boolean {
  return placer !== null;
}

// The Layout tiles' rows (palette-dashboard-tiles): their height and how many slots they bring.
const DASHBOARD_LAYOUT_ROWS: Readonly<Record<string, { height: number; slots: number }>> = {
  'row-metrics': { height: 160, slots: 4 },
  'row-charts': { height: 360, slots: 2 },
  'row-board': { height: 560, slots: 1 },
};

// A Tabs tile's choice, `board:<tabId>` or `sheet:<tabId>` (dashboardTabChoice).
function tabItemOf(rest: string): DashboardItem | null {
  const at = rest.indexOf(':');
  const of = rest.slice(0, at);
  const tabId = rest.slice(at + 1);
  return at > 0 && tabId && (of === 'board' || of === 'sheet' || of === 'diagram')
    ? { kind: 'tab', tabId, of }
    : null;
}

// The cards a slot takes that are written on the page, and a Cards tile's choice (`card:<kind>`).
export const DASHBOARD_CARD_KINDS = ['title', ...DASHBOARD_CARD_TYPES] as const;
export type DashboardCardKind = (typeof DASHBOARD_CARD_KINDS)[number];
const isDashboardCardKind = (v: string): v is DashboardCardKind =>
  (DASHBOARD_CARD_KINDS as readonly string[]).includes(v);
export const dashboardCardChoice = (card: DashboardCardKind) => `card:${card}`;
export const sheetMetricChoice = (metric: SheetMetricKind) => `sheet:${metric}`;
export const SHEET_CHART_CHOICE = 'sheet:chart';
export const formMetricChoice = (metric: FormMetricKind) => `form:${metric}`;

export const dashboardTabChoice = (of: DashboardTabOf, tabId: string) => `tab:${of}:${tabId}`;

function layoutItemOf(id: string): DashboardItem | null {
  if (id === 'slot') return { kind: 'slot' };
  const row = DASHBOARD_LAYOUT_ROWS[id];
  return row ? { kind: 'row', ...row } : null;
}

// The Dashboard item a palette tile of `kind` (with its `choice`) stands for, or null for anything a slot does not take.
export function dashboardItemOf(kind: string, choice?: string): DashboardItem | null {
  if (kind === 'plan-view' && choice?.startsWith('layout:')) return layoutItemOf(choice.slice(7));
  if (kind === 'plan-view' && choice?.startsWith('tab:')) return tabItemOf(choice.slice(4));
  if (kind === 'plan-view' && choice === SHEET_CHART_CHOICE) return { kind: 'sheet-chart' };
  if (kind === 'plan-view' && choice?.startsWith('sheet:')) {
    const metric = choice.slice(6);
    return (SHEET_METRICS as readonly string[]).includes(metric)
      ? { kind: 'sheet-metric', metric: metric as SheetMetricKind }
      : null;
  }
  if (kind === 'plan-view' && choice?.startsWith('form:')) {
    const metric = choice.slice(5);
    return (FORM_METRICS as readonly string[]).includes(metric)
      ? { kind: 'form-metric', metric: metric as FormMetricKind }
      : null;
  }
  if (kind === 'plan-view' && choice?.startsWith('card:')) {
    const card = choice.slice(5);
    return isDashboardCardKind(card) ? { kind: 'card', card } : null;
  }
  if (kind === 'plan-view') return choice ? { kind: 'view', view: choice } : null;
  if (kind === 'plan-board') return { kind: 'board', preset: choice };
  if (kind === 'plan-sheet') return { kind: 'sheet', start: choice };
  if (kind === 'sticky') return { kind: 'note' };
  return null;
}

type Box = { left: number; right: number; top: number; bottom: number };
export type DashboardGeometry = {
  rows: { id: string; box: Box; slots: { id: string; box: Box }[] }[];
};

const boxSize = (b: Box) => ({ width: b.right - b.left, height: b.bottom - b.top });

const inside = (b: Box, x: number, y: number) =>
  x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;

// The zone `item` would drop into at (x, y). Content fills the slot under the pointer; a row goes in the row gap
// nearest the pointer; a slot goes in the gap nearest the pointer within the row it is over (its left or right end, or
// between two slots), or makes a row of its own where it is over no row. Null when the drop would land nowhere
// (content over no slot). Pure: DashboardPage reads the geometry off the page.
export function dashboardZone(
  item: DashboardItem,
  geo: DashboardGeometry,
  x: number,
  y: number,
  // Whether the change the zone makes keeps everything looking good (keepsFit): a slot squeezing a board is no zone.
  allow?: ZoneAllowed,
): DashboardZone | null {
  const z = zoneAt(item, geo, x, y);
  return z && allow && !allow(z) ? null : z;
}

export type ZoneAllowed = (zone: DashboardZone) => boolean;

function zoneAt(
  item: DashboardItem,
  geo: DashboardGeometry,
  x: number,
  y: number,
): DashboardZone | null {
  const rowGap = (): DashboardZone => ({
    kind: 'row-gap',
    index: geo.rows.filter((r) => (r.box.top + r.box.bottom) / 2 < y).length,
  });
  if (item.kind === 'row') return rowGap();
  if (item.kind === 'slot') {
    const row = geo.rows.find((r) => y >= r.box.top && y <= r.box.bottom);
    if (!row) return rowGap();
    return {
      kind: 'slot-gap',
      rowId: row.id,
      index: row.slots.filter((s) => (s.box.left + s.box.right) / 2 < x).length,
    };
  }
  // Content fills the slot under the pointer, if that slot is big enough to draw it well (slot-fit.ts).
  for (const row of geo.rows)
    for (const s of row.slots)
      if (inside(s.box, x, y))
        return fitsSlot(item, boxSize(s.box)) ? { kind: 'slot', slotId: s.id } : null;
  return null;
}

// The page's rows and slots as they are on screen.
export function readDashboardGeometry(root: ParentNode): DashboardGeometry {
  return {
    rows: [...root.querySelectorAll<HTMLElement>('[data-dashboard-row]')].map((row) => ({
      id: row.getAttribute('data-dashboard-row')!,
      box: row.getBoundingClientRect(),
      slots: [...row.querySelectorAll<HTMLElement>('[data-dashboard-slot]')].map((s) => ({
        id: s.getAttribute('data-dashboard-slot')!,
        box: s.getBoundingClientRect(),
      })),
    })),
  };
}

// How near a slot's side counts as its side (a gap) rather than the slot itself (a swap), and a row's top or bottom
// as the gap above or below it.
const MOVE_SIDE_PX = 72;
const MOVE_EDGE_PX = 24;

// Where the slot `fromId` being moved would go at (x, y): onto another slot's middle (a swap), into the gap at a
// slot's side or between two slots, or between rows (near a row's top or bottom, or off every row). Null over itself.
export function dashboardMoveZone(
  geo: DashboardGeometry,
  x: number,
  y: number,
  fromId: string,
  allow?: ZoneAllowed,
): DashboardZone | null {
  const z = moveZoneAt(geo, x, y, fromId);
  return z && allow && !allow(z) ? null : z;
}

function moveZoneAt(
  geo: DashboardGeometry,
  x: number,
  y: number,
  fromId: string,
): DashboardZone | null {
  const r = geo.rows.findIndex((row) => y >= row.box.top && y <= row.box.bottom);
  if (r < 0)
    return {
      kind: 'row-gap',
      index: geo.rows.filter((row) => (row.box.top + row.box.bottom) / 2 < y).length,
    };
  const row = geo.rows[r]!;
  if (y - row.box.top < MOVE_EDGE_PX) return { kind: 'row-gap', index: r };
  if (row.box.bottom - y < MOVE_EDGE_PX) return { kind: 'row-gap', index: r + 1 };
  for (const [i, s] of row.slots.entries()) {
    if (x < s.box.left || x > s.box.right) continue;
    const side = Math.min(MOVE_SIDE_PX, (s.box.right - s.box.left) * 0.2);
    if (x - s.box.left < side) return { kind: 'slot-gap', rowId: row.id, index: i };
    if (s.box.right - x < side) return { kind: 'slot-gap', rowId: row.id, index: i + 1 };
    return s.id === fromId ? null : { kind: 'slot', slotId: s.id };
  }
  // In a gap between two slots.
  return {
    kind: 'slot-gap',
    rowId: row.id,
    index: row.slots.filter((s) => (s.box.left + s.box.right) / 2 < x).length,
  };
}

// Every zone `item` could land in, for a pressed tile waiting for its click (DashboardPage draws them all faintly):
// content any slot; a row any gap between rows; a slot any gap in a row with room, or a row of its own.
export function dashboardCandidates(
  item: DashboardItem,
  geo: DashboardGeometry,
  slotsMax: number,
  allow?: ZoneAllowed,
): DashboardZone[] {
  const all = candidatesOf(item, geo, slotsMax);
  return allow ? all.filter(allow) : all;
}

function candidatesOf(
  item: DashboardItem,
  geo: DashboardGeometry,
  slotsMax: number,
): DashboardZone[] {
  const rowGaps = (): DashboardZone[] =>
    Array.from({ length: geo.rows.length + 1 }, (_, index) => ({ kind: 'row-gap', index }));
  if (item.kind === 'row') return rowGaps();
  if (item.kind === 'slot')
    return [
      ...geo.rows.flatMap((r): DashboardZone[] =>
        r.slots.length >= slotsMax
          ? []
          : Array.from({ length: r.slots.length + 1 }, (_, index) => ({
              kind: 'slot-gap',
              rowId: r.id,
              index,
            })),
      ),
      ...rowGaps(),
    ];
  return geo.rows.flatMap((r) =>
    r.slots
      .filter((s) => fitsSlot(item, boxSize(s.box)))
      .map((s): DashboardZone => ({ kind: 'slot', slotId: s.id })),
  );
}
