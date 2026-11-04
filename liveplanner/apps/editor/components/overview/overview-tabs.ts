// The Overview's tab tiles (docs/specs/026-plan/plan-overview.md "Tabs"): each tab's kind, the line under its name and
// whether its preview can draw, all from what the editor already holds. Pure: the page draws what this answers.
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

// What a tile's preview shows (TabPreview): the tab once its content is here, the loading sweep before, or the tab's
// paper saying nothing is on it yet.
export type TabTileState = 'loading' | 'ready' | 'empty';

export type TabTileSummary = {
  id: string;
  name: string;
  // The kind's word, first on the tile's line ("Board", "Gantt Chart", "Sheet"...).
  kindLabel: string;
  // The rest of the line ("17 Cards"), or null when the kind says it all.
  detail: string | null;
  state: TabTileState;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
  return {
    id: tab.id,
    name: tab.name,
    kindLabel: 'Board',
    detail: plural(count, 'Card', 'Cards'),
    state: 'ready',
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
  return {
    id: tab.id,
    name: tab.name,
    kindLabel: label,
    detail: plural(count, 'Card', 'Cards'),
    state: 'ready',
  };
}

function dashboardTile(tab: Tab, layout: DashboardLayout): TabTileSummary {
  const slots = layout.rows.reduce((n, r) => n + r.slots.length, 0);
  return {
    id: tab.id,
    name: tab.name,
    kindLabel: 'Dashboard',
    detail: plural(slots, 'Slot', 'Slots'),
    state: 'ready',
  };
}

const notStarted = (tab: Tab): TabTileSummary => ({
  id: tab.id,
  name: tab.name,
  kindLabel: 'Not Started',
  detail: null,
  state: 'empty',
});

// One tab's tile.
export function tabTileOf(tab: Tab, input: TileInput): TabTileSummary {
  if (isTabWaiting(tab, input.loaded))
    return {
      id: tab.id,
      name: tab.name,
      kindLabel: 'Loading…',
      detail: null,
      state: 'loading',
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
            state: 'ready',
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
        state: 'ready',
      };
    }
    default:
      return notStarted(tab);
  }
}

export function tabTilesOf(tabs: readonly Tab[], input: TileInput): TabTileSummary[] {
  return tabs.map((tab) => tabTileOf(tab, input));
}
