// The Overview's tab tiles (docs/specs/026-plan/plan-overview.md "Tabs"): each tab's kind, the line under its name and
// the little picture drawn of it, all from what the editor already holds. Pure: the page draws what this answers.
import {
  PLAN_VISUALISATION_LABELS,
  TRASH_STATUS,
  dayNumber,
  planViewMetric,
  type Item,
  type ItemTypeDef,
  type PlanVisualisation,
} from '@liveplanner/items';
import { questionsOf, readForm } from '@liveplanner/forms';
import {
  readDashboard,
  type DashboardLayout,
  type PlanViewRef,
  type Tab,
} from '@liveplanner/project';
import { boardOfTab, boardShows, boardStatuses } from './overview-boards';

// How much of a board its tile draws (blueprint DEFAULTS D82), and of anything else.
export const TILE_COLUMNS_MAX = 4;
export const TILE_CARDS_MAX = 3;
export const TILE_BARS_MAX = 5;
const TILE_ROWS_MAX = 3;
const TILE_FIELDS_MAX = 2;

// A card drawn on a tile: its type's colour.
type TileCard = { id: string; colour: string };

export type TabTilePicture =
  | { kind: 'board'; columns: { id: string; cards: TileCard[] }[] }
  // A bar per card, as fractions of the tile's width: where it starts and how long it runs.
  | { kind: 'bars'; bars: { id: string; colour: string; x: number; w: number }[] }
  | { kind: 'sheet' }
  // A dashboard's rows, each its slots' spans (twelfths) and what they hold.
  | {
      kind: 'dashboard';
      rows: { id: string; slots: { id: string; span: number; filled: boolean }[] }[];
    }
  | { kind: 'form'; fields: number }
  | { kind: 'empty' }
  | { kind: 'loading' };

export type TabTileSummary = {
  id: string;
  name: string;
  // The kind's word, first on the tile's line ("Board", "Gantt Chart", "Sheet"...).
  kindLabel: string;
  // The rest of the line ("17 Cards"), or null when the kind says it all.
  detail: string | null;
  picture: TabTilePicture;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// A card whose type the plan no longer has.
export const NO_TYPE_COLOUR = '#94a3b8';

// A tab whose content has not arrived is a placeholder with no kind and nothing on it (per-tab-storage.md).
export function isTabWaiting(tab: Tab, loaded: ReadonlySet<string>): boolean {
  return !loaded.has(tab.id) && !tab.kind && tab.elements.length === 0;
}

// The one plan view a Visualisation tab holds: a Dashboard of one filling row with one slot naming a plan view.
export function visualisationOf(tab: Tab, layout: DashboardLayout | null): PlanViewRef | null {
  if (!layout || layout.rows.length !== 1) return null;
  const row = layout.rows[0]!;
  if (!row.fill || row.slots.length !== 1) return null;
  const content = row.slots[0]!.content;
  if (content?.type !== 'element') return null;
  const el = tab.elements.find((e) => e.id === content.elementId);
  if (!el || el.type !== 'shape' || el.shape !== 'plan-view' || !el.planView) return null;
  return planViewMetric(el.planView.view) ? null : el.planView;
}

export type TileInput = {
  items: ReadonlyMap<string, Item>;
  // The cards by status (cardsByStatus), shared with the other derivations.
  byStatus: ReadonlyMap<string, readonly Item[]>;
  types: readonly ItemTypeDef[];
  colourOf: (typeId: string) => string;
  loaded: ReadonlySet<string>;
};

function boardTile(tab: Tab, input: TileInput): TabTileSummary | null {
  const setup = boardOfTab(tab);
  if (!setup) return null;
  const statuses = boardStatuses(setup);
  const shows = (it: Item) => boardShows(setup, it, input.types, statuses);
  let count = 0;
  if (setup.archive || setup.allCards) {
    for (const it of input.items.values()) if (shows(it)) count += 1;
  } else {
    for (const status of statuses)
      for (const it of input.byStatus.get(status) ?? []) if (shows(it)) count += 1;
  }
  const columns = setup.columns.slice(0, TILE_COLUMNS_MAX).map((col) => {
    const cards: TileCard[] = [];
    if (!setup.archive && !setup.allCards) {
      for (const it of input.byStatus.get(col.status) ?? []) {
        if (cards.length >= TILE_CARDS_MAX) break;
        if (shows(it)) cards.push({ id: it.id, colour: input.colourOf(it.type) });
      }
    }
    return { id: col.id, cards };
  });
  return {
    id: tab.id,
    name: tab.name,
    kindLabel: 'Board',
    detail: plural(count, 'Card', 'Cards'),
    picture: { kind: 'board', columns },
  };
}

function viewTile(tab: Tab, view: PlanViewRef, input: TileInput): TabTileSummary {
  const label = PLAN_VISUALISATION_LABELS[view.view as PlanVisualisation] ?? 'Chart';
  const shown = view.types?.length ? new Set(view.types) : null;
  const read: Item[] = [];
  for (const [status, group] of input.byStatus) {
    if (status === TRASH_STATUS) continue;
    for (const it of group) if (!shown || shown.has(it.type)) read.push(it);
  }
  const gantt = view.view === 'gantt';
  // A Gantt chart reads the cards with a Start and a Due; any other view every card of its types.
  const dated = read.flatMap((it) => {
    const start = dayNumber(it.fields['start']);
    const due = dayNumber(it.fields['due']);
    return start !== undefined && due !== undefined && due >= start ? [{ it, start, due }] : [];
  });
  const count = gantt ? dated.length : read.length;
  let bars: { id: string; colour: string; x: number; w: number }[];
  if (dated.length > 0) {
    const first = dated
      .slice()
      .sort((a, b) => a.start - b.start || a.it.key - b.it.key)
      .slice(0, TILE_BARS_MAX);
    const lo = Math.min(...first.map((d) => d.start));
    const hi = Math.max(...first.map((d) => d.due + 1));
    const span = Math.max(1, hi - lo);
    bars = first.map((d) => ({
      id: d.it.id,
      colour: input.colourOf(d.it.type),
      x: (d.start - lo) / span,
      w: Math.max(0.08, (d.due + 1 - d.start) / span),
    }));
  } else {
    // Any other view: its cards by status, a bar per status as long as its share of the busiest one's.
    const byStatus = new Map<string, Item[]>();
    for (const it of read) {
      const key = typeof it.fields['status'] === 'string' ? it.fields['status'] : '';
      const group = byStatus.get(key);
      if (group) group.push(it);
      else byStatus.set(key, [it]);
    }
    const groups = [...byStatus.entries()]
      .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
      .slice(0, TILE_BARS_MAX);
    const most = groups[0]?.[1].length ?? 1;
    bars = groups.map(([status, group]) => ({
      id: status,
      colour: input.colourOf(group[0]!.type),
      x: 0,
      w: group.length / most,
    }));
  }
  return {
    id: tab.id,
    name: tab.name,
    kindLabel: label,
    detail: plural(count, 'Card', 'Cards'),
    picture: { kind: 'bars', bars },
  };
}

function dashboardTile(tab: Tab, layout: DashboardLayout): TabTileSummary {
  const slots = layout.rows.reduce((n, r) => n + r.slots.length, 0);
  return {
    id: tab.id,
    name: tab.name,
    kindLabel: 'Dashboard',
    detail: plural(slots, 'Slot', 'Slots'),
    picture: {
      kind: 'dashboard',
      rows: layout.rows.slice(0, TILE_ROWS_MAX).map((r) => ({
        id: r.id,
        slots: r.slots.map((s) => ({ id: s.id, span: s.span, filled: s.content !== undefined })),
      })),
    },
  };
}

const notStarted = (tab: Tab): TabTileSummary => ({
  id: tab.id,
  name: tab.name,
  kindLabel: 'Not Started',
  detail: null,
  picture: { kind: 'empty' },
});

// One tab's tile.
export function tabTileOf(tab: Tab, input: TileInput): TabTileSummary {
  if (isTabWaiting(tab, input.loaded))
    return {
      id: tab.id,
      name: tab.name,
      kindLabel: 'Loading…',
      detail: null,
      picture: { kind: 'loading' },
    };
  switch (tab.kind) {
    case 'board':
      return boardTile(tab, input) ?? notStarted(tab);
    case 'sheet':
      return tab.elements.some((e) => e.type === 'shape' && e.shape === 'plan-sheet')
        ? {
            id: tab.id,
            name: tab.name,
            kindLabel: 'Sheet',
            detail: null,
            picture: { kind: 'sheet' },
          }
        : notStarted(tab);
    case 'dashboard': {
      const layout = readDashboard(tab.dashboard);
      if (!layout || layout.rows.length === 0) return notStarted(tab);
      const view = visualisationOf(tab, layout);
      return view ? viewTile(tab, view, input) : dashboardTile(tab, layout);
    }
    case 'form': {
      const form = readForm(tab.form);
      if (!form) return notStarted(tab);
      const questions = questionsOf(form).length;
      return {
        id: tab.id,
        name: tab.name,
        kindLabel: 'Form',
        detail: plural(questions, 'Question', 'Questions'),
        picture: { kind: 'form', fields: Math.min(TILE_FIELDS_MAX, Math.max(1, questions)) },
      };
    }
    default:
      return notStarted(tab);
  }
}

export function tabTilesOf(tabs: readonly Tab[], input: TileInput): TabTileSummary[] {
  return tabs.map((tab) => tabTileOf(tab, input));
}
