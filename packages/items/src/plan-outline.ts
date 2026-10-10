// A document's plan as agents read it (docs/specs/026-plan/plan-agents.md "Reading the plan"): its Plan boards in
// tab then canvas order, the statuses they name (each once, the first board's name winning) and the card types.
// Pure: the api's plan route builds it from tab bodies, and the editor names its statuses the same way.
import type { PlanBoardSetup } from './board';
import { normaliseBoardSetup } from './board';
import type { ItemTypeDef } from './item-types';
import { typesOf, type ItemTypeCatalogue } from './type-catalogue';

export type PlanBoardKind = 'board' | 'all-cards' | 'archive';

export interface PlanColumnOutline {
  status: string;
  name: string;
  wipLimit?: number;
}

export interface PlanBoardOutline {
  tabId: string;
  tabName: string;
  elementId: string;
  title: string;
  kind: PlanBoardKind;
  // The card types it shows and takes; null is every type, and an empty list none (a board whose last type was
  // turned off: the editor shows no card on it).
  types: string[] | null;
  columns: PlanColumnOutline[];
}

export interface PlanStatusName {
  status: string;
  name: string;
}

export interface PlanOutline {
  boards: PlanBoardOutline[];
  statuses: PlanStatusName[];
  types: readonly ItemTypeDef[];
}

export interface PlanTabInput {
  id: string;
  name: string;
  elements: readonly unknown[];
}

const kindOf = (setup: PlanBoardSetup): PlanBoardKind =>
  setup.archive ? 'archive' : setup.allCards ? 'all-cards' : 'board';

// A tab's Plan board set-ups, with their element ids, in canvas order; a damaged set-up is skipped.
export function boardSetupsOfTab(
  elements: readonly unknown[],
): { elementId: string; setup: PlanBoardSetup }[] {
  const out: { elementId: string; setup: PlanBoardSetup }[] = [];
  for (const raw of elements) {
    if (typeof raw !== 'object' || raw === null) continue;
    const el = raw as { id?: unknown; shape?: unknown; planBoard?: unknown };
    if (el.shape !== 'plan-board' || typeof el.id !== 'string') continue;
    const setup = normaliseBoardSetup(el.planBoard);
    if (setup) out.push({ elementId: el.id, setup });
  }
  return out;
}

// Each status the set-ups name as a column, once, with the first board's name for it. All Cards and Archive
// boards file by what a card is, not by status, so they name none.
export function statusColumnsOfSetups(setups: readonly unknown[]): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Set<string>();
  for (const raw of setups) {
    const setup = normaliseBoardSetup(raw);
    if (!setup || setup.allCards || setup.archive) continue;
    for (const c of setup.columns) {
      if (seen.has(c.status)) continue;
      seen.add(c.status);
      out.push([c.status, c.name]);
    }
  }
  return out;
}

export function planOutline(
  tabs: readonly PlanTabInput[],
  catalogue: ItemTypeCatalogue | null | undefined,
): PlanOutline {
  const boards: PlanBoardOutline[] = [];
  const setups: PlanBoardSetup[] = [];
  for (const tab of tabs) {
    for (const { elementId, setup } of boardSetupsOfTab(tab.elements)) {
      setups.push(setup);
      boards.push({
        tabId: tab.id,
        tabName: tab.name,
        elementId,
        title: setup.title,
        kind: kindOf(setup),
        types: setup.addTypes ? [...setup.addTypes] : null,
        columns: setup.columns.map((c) => ({
          status: c.status,
          name: c.name,
          ...(c.wipLimit ? { wipLimit: c.wipLimit } : {}),
        })),
      });
    }
  }
  return {
    boards,
    statuses: statusColumnsOfSetups(setups).map(([status, name]) => ({ status, name })),
    types: typesOf(catalogue),
  };
}
