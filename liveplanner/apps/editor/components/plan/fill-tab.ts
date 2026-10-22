// Fill Tab (docs/specs/026-plan/plan-board.md "Fill Tab"): which board, Sheet or view fills a tab, and the tab once a
// board fills it. Pure.
import { readDashboard, type DashboardLayout, type Element } from '@liveplanner/project';

const isBoard = (el: Element) => el.type === 'shape' && el.shape === 'plan-board';

const isSheet = (el: Element) => el.type === 'shape' && el.shape === 'plan-sheet';

type FillTabKind = 'Board' | 'Sheet' | 'View';

// A Visualisation tab (docs/specs/026-plan/plan-tabs.md "A row that fills the page"): a Dashboard of one row that fills
// the page holding one visualisation. That visualisation fills the tab as a Board tab's board does. The stored layout is
// read safely (readDashboard): a malformed one fills nothing rather than throwing for everyone who opens the tab.
function soloView(
  elements: readonly Element[],
  dashboard: DashboardLayout | undefined,
): Element | null {
  const rows = readDashboard(dashboard)?.rows ?? [];
  if (rows.length !== 1 || !rows[0]!.fill || rows[0]!.slots.length !== 1) return null;
  const content = rows[0]!.slots[0]!.content;
  if (content?.type !== 'element') return null;
  const el = elements.find((e) => e.id === content.elementId);
  if (!el || el.type !== 'shape' || el.shape !== 'plan-view') return null;
  const view = (el as { planView?: { view?: string } }).planView?.view ?? '';
  return view.startsWith('metric:') ? null : el;
}

// The element filling the tab: the first (in canvas order) board whose set-up has Fill Tab on, or Sheet whose
// `planSheet` has, or null. Reads the stored flag exactly (true), without normalising every board. On a Board or Sheet
// tab (docs/specs/026-plan/plan-tabs.md) its first board or Sheet fills it, whatever its flag says.
export function fillTabElementOf(
  elements: readonly Element[],
  tabKind?: string,
  dashboard?: DashboardLayout,
): { id: string; kind: FillTabKind } | null {
  if (tabKind === 'dashboard') {
    const view = soloView(elements, dashboard);
    return view ? { id: view.id, kind: 'View' } : null;
  }
  if (tabKind === 'board' || tabKind === 'sheet') {
    const own = elements.find(tabKind === 'board' ? isBoard : isSheet);
    return own ? { id: own.id, kind: tabKind === 'board' ? 'Board' : 'Sheet' } : null;
  }
  for (const el of elements) {
    if (isBoard(el)) {
      const setup = (el as { planBoard?: unknown }).planBoard;
      if (setup && typeof setup === 'object' && (setup as { fillTab?: unknown }).fillTab === true)
        return { id: el.id, kind: 'Board' };
    } else if (isSheet(el)) {
      if ((el as { planSheet?: { fillTab?: unknown } }).planSheet?.fillTab === true)
        return { id: el.id, kind: 'Sheet' };
    }
  }
  return null;
}
