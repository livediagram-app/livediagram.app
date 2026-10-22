// Plan boards and Sheets named after their tab (docs/specs/026-plan/plan-board.md "The board set-up",
// docs/specs/029-sheets/sheet.md "Placing a sheet"): a new one takes the tab's name, and one still carrying the tab's
// default name follows the tab when it is renamed away from it. Pure: the tab rename applies it in the same commit.
import {
  isDefaultTabName,
  truncateName,
  type DashboardLayout,
  type Element,
  type PlanViewRef,
} from '@liveplanner/project';
import { PLAN_TITLE_MAX, PLAN_VIEW_TITLE_MAX } from '@liveplanner/items';
import { fillTabElementOf } from '@/components/plan/fill-tab';

// The title a board placed on a tab takes: the tab's name, else (no name, or still a default one such as "Tab 2", which
// names nothing) the preset's own; a Board tab then takes the board's (docs/specs/026-plan/plan-tabs.md "Names").
export function boardTitleForTab(tabName: string | undefined, presetTitle: string): string {
  const name = (tabName ?? '').trim().slice(0, PLAN_TITLE_MAX).trim();
  return name && !isDefaultTabName(name) ? name : presetTitle;
}

// The name a default-named tab takes from the board or Sheet that fills it: the board's title, or the title the
// Sheet was placed with. Null when the tab has a name of its own, or nothing names it.
export function tabNameFromPlan(
  tab: { name: string; elements: readonly Element[] },
  sheetTitle: (sheetId: string) => string | undefined,
): string | null {
  if (!isDefaultTabName(tab.name)) return null;
  for (const el of tab.elements) {
    if (el.type !== 'shape') continue;
    if (el.shape === 'plan-board' && el.planBoard?.title.trim()) return el.planBoard.title.trim();
    if (el.shape === 'plan-sheet' && el.planSheet) {
      const t = sheetTitle(el.planSheet.sheetId)?.trim();
      if (t) return t;
    }
  }
  return null;
}

// The tab's elements once it is renamed from `from` to `to`: when `from` was a default name ("Tab 2"), each board
// titled exactly that takes the new name. The same array when nothing changes.
export function boardsRenamedWithTab(elements: Element[], from: string, to: string): Element[] {
  if (!isDefaultTabName(from)) return elements;
  const title = boardTitleForTab(to, from);
  let changed = false;
  const next = elements.map((el) => {
    if (el.type !== 'shape' || el.shape !== 'plan-board' || !el.planBoard) return el;
    if (el.planBoard.title !== from.trim()) return el;
    changed = true;
    return { ...el, planBoard: { ...el.planBoard, title } };
  });
  return changed ? next : elements;
}

// The tab's elements with every board titled `to` (a Board tab's board follows its name, plan-tabs.md). The same array
// when nothing changes.
export function boardsTitled(elements: Element[], to: string): Element[] {
  const title = boardTitleForTab(to, to);
  let changed = false;
  const next = elements.map((el) => {
    if (el.type !== 'shape' || el.shape !== 'plan-board' || !el.planBoard) return el;
    if (el.planBoard.title === title) return el;
    changed = true;
    return { ...el, planBoard: { ...el.planBoard, title } };
  });
  return changed ? next : elements;
}

// The Sheets on a tab, by sheet id: the ones a rename may retitle.
export function sheetIdsOn(elements: readonly Element[]): string[] {
  const out: string[] = [];
  for (const el of elements)
    if (el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet)
      out.push(el.planSheet.sheetId);
  return out;
}

// A Board tab once its board is titled `title` (docs/specs/026-plan/plan-tabs.md "Names"): named the same, as a Board
// tab and its board share one name. Any other tab, an empty title or an unchanged name: the same tab.
export function tabNamedForBoard<T extends { kind?: string; name: string }>(
  tab: T,
  title: string,
): T {
  const name = truncateName(title.trim());
  return tab.kind === 'board' && name && name !== tab.name ? { ...tab, name } : tab;
}

// A Visualisation tab's elements once the tab is named `to` (docs/specs/026-plan/plan-tabs.md "Names"): its chart takes
// the name as its own title. The same array for any other tab.
export function viewsTitled(
  tab: { kind?: string; elements: Element[]; dashboard?: DashboardLayout },
  to: string,
): Element[] {
  const solo = fillTabElementOf(tab.elements, tab.kind, tab.dashboard);
  if (!solo || solo.kind !== 'View') return tab.elements;
  const title = to.trim().slice(0, PLAN_VIEW_TITLE_MAX);
  return tab.elements.map((el) => {
    const ref = (el as { planView?: PlanViewRef }).planView;
    return el.id === solo.id && ref && ref.title !== title
      ? ({ ...el, planView: { ...ref, title } } as Element)
      : el;
  });
}

// A Board, Sheet or Visualisation tab's elements once the tab is named `to`: its board, or its chart, shares the name
// (docs/specs/026-plan/plan-tabs.md "Names"). Null for any other tab, whose boards follow only a default name.
export function planTitledWithTab(
  tab: { kind?: string; elements: Element[]; dashboard?: DashboardLayout },
  to: string,
): Element[] | null {
  if (tab.kind === 'board' || tab.kind === 'sheet') return boardsTitled(tab.elements, to);
  if (tab.kind === 'dashboard') return viewsTitled(tab, to);
  return null;
}

// A Visualisation tab once its chart `viewId` is titled `title`: named the same.
export function tabNamedForView<
  T extends {
    kind?: string;
    name: string;
    elements: readonly Element[];
    dashboard?: DashboardLayout;
  },
>(tab: T, viewId: string, title: string | undefined): T {
  const name = truncateName((title ?? '').trim());
  if (!name || name === tab.name) return tab;
  const solo = fillTabElementOf(tab.elements, tab.kind, tab.dashboard);
  return solo?.kind === 'View' && solo.id === viewId ? { ...tab, name } : tab;
}

// A Sheet tab once its sheet `sheetId` is titled `title`: named the same, as a Sheet tab and its sheet share one name.
export function tabNamedForSheet<
  T extends { kind?: string; name: string; elements: readonly Element[] },
>(tab: T, sheetId: string, title: string): T {
  const name = truncateName(title.trim());
  if (tab.kind !== 'sheet' || !name || name === tab.name) return tab;
  const holds = tab.elements.some(
    (el) => el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet?.sheetId === sheetId,
  );
  return holds ? { ...tab, name } : tab;
}
