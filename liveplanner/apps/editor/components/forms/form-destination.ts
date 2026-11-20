// Where a Form tab's responses go, as this session sees it (docs/specs/030-forms/forms.md "Responses Go To",
// "Publishing and the form link", "Responses to a Sheet"). A board form names a card type and a column, never a
// board: its cards show on every board that takes them, worked out here from the plan's tabs. So: the boards that
// show them, the one its buttons open (the home board), what is wrong, if anything, and the warning a holding
// destination may carry (its column one its card type leaves out, "Columns follow the card type"), in words.
import type { Element, Tab } from '@liveplanner/project';
import { boardsShowing, type ItemTypeDef, type PlanBoardSetup } from '@liveplanner/items';
import {
  destinationProblem,
  destinationType,
  destinationWarning,
  destinationWarningText,
  sheetDestinationProblem,
  type DestinationProblem,
  type FormDefinition,
  type FormDestination,
} from '@liveplanner/forms';
import { boardsOf, sheetsOf } from '@liveplanner/templates';

/** A board of the plan with the tab it is on. */
export type PlacedBoard = { tab: Tab; element: Element; setup: PlanBoardSetup };

// Each tab's boards, kept by its elements array: the tab bar and the builder ask on every render, and a change
// rewrites only the tabs it touches.
const placed = new WeakMap<readonly Element[], PlacedBoard[]>();

/** Every board a card may be seen on (boardsOf: no Archive, no All Cards, none without columns), in tab order. */
export function planBoardsOf(tabs: readonly Tab[]): PlacedBoard[] {
  return tabs.flatMap((tab) => {
    if (tab.kind !== 'board') return [];
    const hit = placed.get(tab.elements);
    if (hit && hit[0]?.tab === tab) return hit;
    const made = boardsOf(tab).map((b) => ({ tab, element: b.element, setup: b.setup }));
    placed.set(tab.elements, made);
    return made;
  });
}

/** The set-ups of some boards, as a destination and its card type rules are judged against them. */
export const setupsOf = (boards: readonly PlacedBoard[]): PlanBoardSetup[] =>
  boards.map((b) => b.setup);

/** The boards that show a destination's cards, the one on the tab it was last seen on first. */
export function boardsShowingOf(
  destination: Pick<FormDestination, 'typeId' | 'status' | 'tabId'> | undefined,
  boards: readonly PlacedBoard[],
  types: readonly ItemTypeDef[],
): PlacedBoard[] {
  if (!destination) return [];
  const shows = boards.filter((b) => boardsShowing([b.setup], types, destination).length > 0);
  const home = shows.findIndex((b) => b.tab.id === destination.tabId);
  return home > 0 ? [shows[home]!, ...shows.filter((_, i) => i !== home)] : shows;
}

export function formDestinationOf(
  form: FormDefinition,
  tabs: readonly Tab[],
  types: readonly ItemTypeDef[],
  // The one tab a tab-scoped share session reaches (docs/specs/013-workspace/tab-scoped-share-links.md); null for
  // everyone else.
  tabScope: string | null,
): {
  destTab: Tab | undefined;
  problem: DestinationProblem | null;
  warning: string | null;
  // The boards its cards show on, by tab name, home first (none for a sheet form).
  showsOn: string[];
} {
  // A session on a link to the Form tab alone sees the other tabs as nameless stubs with no content, so where its
  // responses go can't be judged here: never read as removed, nor named. The api still checks it on every response.
  if (tabScope !== null && (form.sheet || form.destination))
    return { destTab: undefined, problem: null, warning: null, showsOn: [] };
  if (form.sheet) {
    return {
      destTab: tabs.find((t) => t.id === form.sheet!.tabId),
      problem: sheetDestinationProblem(form.sheet, sheetsOf(tabs)),
      warning: null,
      showsOn: [],
    };
  }
  const boards = planBoardsOf(tabs);
  const all = setupsOf(boards);
  const problem = destinationProblem(form.destination, all, types);
  const shows = boardsShowingOf(form.destination, boards, types);
  const destTab = shows[0]?.tab;
  const type = destinationType(form.destination, types);
  const warned = problem || !type ? null : destinationWarning(form.destination, all, type);
  const warning =
    warned && type
      ? destinationWarningText(warned, type.label, destTab?.name ?? 'its board')
      : null;
  return {
    destTab,
    problem,
    warning,
    showsOn: [...new Set(shows.map((b) => b.tab.name))],
  };
}
