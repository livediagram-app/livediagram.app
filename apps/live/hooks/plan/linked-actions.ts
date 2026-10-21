// The canvas half of the Actions board (docs/specs/026-plan/linked-boards.md): where the document's actions and its
// Actions board are, and the tab changes the heal asks for. Pure, so useLinkedActionCards stays wiring.
import {
  elementActions,
  isBoxed,
  type Element,
  type ElementAction,
  type Tab,
} from '@liveplanner/document';
import { collectingBoard, type LinkedRecordChange, type PlanBoardSetup } from '@liveplanner/items';

export type PlacedAction = { tabId: string; elementId: string; action: ElementAction };
export type CollectingBoard = { tabId: string; elementId: string; setup: PlanBoardSetup };

// Each tab's actions and boards, kept by its elements array: a change rewrites only the tabs it touches, so a drag on
// one tab re-reads that tab alone (blueprint linked-boards.md "Performance and limits").
type TabScan = { actions: PlacedAction[]; boards: CollectingBoard[] };
const scans = new WeakMap<readonly Element[], Map<string, TabScan>>();

function scanOf(tab: Tab): TabScan {
  let byTab = scans.get(tab.elements);
  const hit = byTab?.get(tab.id);
  if (hit) return hit;
  const scan: TabScan = { actions: [], boards: [] };
  for (const el of tab.elements) {
    if (el.type === 'shape' && el.shape === 'plan-board' && el.planBoard)
      scan.boards.push({ tabId: tab.id, elementId: el.id, setup: el.planBoard });
    if (!isBoxed(el)) continue;
    for (const action of elementActions(el))
      scan.actions.push({ tabId: tab.id, elementId: el.id, action });
  }
  if (!byTab) scans.set(tab.elements, (byTab = new Map<string, TabScan>()));
  byTab.set(tab.id, scan);
  return scan;
}

// Every action on the loaded tabs, in tab order. A tab not loaded yet holds an empty placeholder, so it is skipped
// rather than read as having none.
export function placedActions(tabs: readonly Tab[], loaded: ReadonlySet<string>): PlacedAction[] {
  return tabs.flatMap((tab) => (loaded.has(tab.id) ? scanOf(tab).actions : []));
}

// The document's Actions board: the first board, in tab order, that collects actions.
export function actionsBoardIn(tabs: readonly Tab[]): CollectingBoard | null {
  return (
    collectingBoard(
      tabs.flatMap((tab) => scanOf(tab).boards),
      'actions',
    ) ?? null
  );
}

// Tabs whose content is not here yet, and so could hold the Actions board: what is fetched before deciding there is
// none, so a second one is never made beside one on a tab nobody has opened. Every unloaded tab, since a document's
// summary does not say which tabs are Board tabs.
export function unloadedTabIds(tabs: readonly Tab[], loaded: ReadonlySet<string>): string[] {
  return tabs.filter((t) => !loaded.has(t.id)).map((t) => t.id);
}

// The element's actions with `fn` applied to the one named `actionId`: written back as an Action panel's list or an
// ordinary element's single action, as useEditorActions writes them.
function withActions(el: Element, fn: (list: ElementAction[]) => ElementAction[]): Element {
  if (!isBoxed(el)) return el;
  const next = fn(elementActions(el));
  const { action: _one, actions: _many, ...rest } = el as typeof el & { actions?: ElementAction[] };
  if (el.type === 'shape' && el.shape === 'action-card')
    return { ...rest, actions: next } as Element;
  return next[0] ? { ...rest, action: next[0] } : rest;
}

// The heal's record changes written onto the loaded tabs that hold them (by action id, wherever the action is now).
// The same array when nothing changed.
export function applyActionChanges(
  tabs: Tab[],
  changes: readonly (LinkedRecordChange & { updatedAt: number })[],
  loaded: ReadonlySet<string>,
): Tab[] {
  if (!changes.length) return tabs;
  const byId = new Map(changes.map((c) => [c.id, c]));
  let changed = false;
  const next = tabs.map((tab) => {
    if (!loaded.has(tab.id)) return tab;
    let tabChanged = false;
    const elements = tab.elements.map((el) => {
      if (!isBoxed(el) || !elementActions(el).some((a) => byId.has(a.id))) return el;
      tabChanged = true;
      return withActions(el, (list) =>
        list.map((a) => {
          const c = byId.get(a.id);
          if (!c) return a;
          return {
            ...a,
            ...(c.title !== undefined ? { name: c.title } : {}),
            ...(c.description !== undefined ? { description: c.description } : {}),
            ...(c.status !== undefined ? { status: c.status } : {}),
            updatedAt: c.updatedAt,
          };
        }),
      );
    });
    if (!tabChanged) return tab;
    changed = true;
    return { ...tab, elements };
  });
  return changed ? next : tabs;
}

// The tabs without the action `actionId` (its card was deleted, docs/specs/026-plan/linked-boards.md "The link").
export function removeAction(tabs: Tab[], actionId: string, loaded: ReadonlySet<string>): Tab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (!loaded.has(tab.id)) return tab;
    let tabChanged = false;
    const elements = tab.elements.map((el) => {
      if (!isBoxed(el) || !elementActions(el).some((a) => a.id === actionId)) return el;
      tabChanged = true;
      return withActions(el, (list) => list.filter((a) => a.id !== actionId));
    });
    if (!tabChanged) return tab;
    changed = true;
    return { ...tab, elements };
  });
  return changed ? next : tabs;
}

// An action put back on the element it was taken from (its card came back from the Trash), if that element is still
// on a loaded tab and does not hold it already. An ordinary element that has gained another action meanwhile keeps it.
export function restoreAction(tabs: Tab[], was: PlacedAction, loaded: ReadonlySet<string>): Tab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.id !== was.tabId || !loaded.has(tab.id)) return tab;
    const elements = tab.elements.map((el) => {
      if (el.id !== was.elementId || !isBoxed(el)) return el;
      const list = elementActions(el);
      const card = el.type === 'shape' && el.shape === 'action-card';
      if (list.some((a) => a.id === was.action.id) || (!card && list.length)) return el;
      changed = true;
      return withActions(el, (l) => [...l, was.action]);
    });
    return changed ? { ...tab, elements } : tab;
  });
  return changed ? next : tabs;
}

// Actions that were on a loaded tab and are no longer anywhere loaded: deleted, or their element or tab was. Their
// cards go to the Trash (and come back if an undo brings the action back).
export function goneActionIds(before: ReadonlySet<string>, now: readonly PlacedAction[]): string[] {
  const present = new Set(now.map((p) => p.action.id));
  return [...before].filter((id) => !present.has(id));
}
