// The boards an address may belong to and what it makes (docs/specs/026-plan/email-to-board.md "What a message
// makes"): each Plan board on the plan's tabs, with the card an address turned on there makes unless told otherwise
// (the board's first card type in its first column, as its own + would), and the card types and columns an address
// may be given instead. An address makes a card of a type in a column, a card target (@liveplanner/items): the
// boards that show it are worked out from every board here, never named. An All Cards or archive board has no column
// for new cards.
import type { EmailIntakeBoard, EmailIntakeTarget, EmailIntakeType } from '@liveplanner/api-schema';
import { typeColumns } from '@liveplanner/forms';
import {
  boardAddTypes,
  boardsShowing,
  cardTargetProblem,
  normaliseBoardSetup,
  targetColumns,
  type CardTarget,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { publishable } from '../roadmap/roadmap-boards';
import { planTabs } from '../routes/plan-route';
import type { PlanEnv } from '../types';

/** A board as the dialog lists it, with its set-up (null: it has no column for new cards). */
export type IntakeBoard = Omit<EmailIntakeBoard, 'target'> & {
  place: CardTarget | null;
  // Its set-up while cards may be added to it: what a target is judged against.
  setup: PlanBoardSetup | null;
};

/** Every Plan board on the plan's tabs, in tab order. */
export async function intakeBoardsOf(
  env: PlanEnv,
  planId: string,
  types: readonly ItemTypeDef[],
): Promise<IntakeBoard[]> {
  const boards: IntakeBoard[] = [];
  for (const tab of await planTabs({ env }, planId, null)) {
    for (const el of tab.elements) {
      const e = el as { id?: unknown; shape?: unknown; planBoard?: unknown };
      if (e.shape !== 'plan-board' || typeof e.id !== 'string') continue;
      const setup = normaliseBoardSetup(e.planBoard);
      if (!setup) continue;
      const open = publishable(setup);
      const first = open ? setup.columns[0] : undefined;
      const type = boardAddTypes(setup, types)[0];
      boards.push({
        id: e.id,
        title: setup.title.trim() || 'Board',
        tabId: tab.id,
        tabName: tab.name,
        column: first && type ? first.name : null,
        place: first && type ? { status: first.status, typeId: type.id } : null,
        setup: open ? setup : null,
      });
    }
  }
  return boards;
}

const setupsOf = (boards: readonly IntakeBoard[]): PlanBoardSetup[] =>
  boards.flatMap((b) => (b.setup ? [b.setup] : []));

/**
 * A target as the wire carries it: its type and column by name and the Board tabs that show such a card. Null when
 * no board shows it (its type or column gone, or no board taking the type has the column), so mail is refused
 * rather than made where nobody sees it.
 */
export function intakeTargetOf(
  target: CardTarget | null,
  boards: readonly IntakeBoard[],
  types: readonly ItemTypeDef[],
): EmailIntakeTarget | null {
  if (!target || cardTargetProblem(target, setupsOf(boards), types)) return null;
  const type = types.find((t) => t.id === target.typeId)!;
  const shows = boards.filter((b) => b.setup && boardsShowing([b.setup], types, target).length > 0);
  const column = shows[0]!.setup!.columns.find((c) => c.status === target.status)!;
  return {
    typeId: target.typeId,
    status: target.status,
    cardType: type.label,
    column: column.name,
    showsOn: [...new Set(shows.map((b) => b.tabName))],
  };
}

/** The card types some board shows, each with the columns its cards can be seen in (those the type uses). */
export function intakeTypesOf(
  boards: readonly IntakeBoard[],
  types: readonly ItemTypeDef[],
): EmailIntakeType[] {
  const setups = setupsOf(boards);
  return types.flatMap((type) => {
    const columns = typeColumns(targetColumns(setups, types, type.id), type);
    return columns.length
      ? [
          {
            id: type.id,
            label: type.label,
            columns: columns.map((c) => ({ status: c.status, name: c.name })),
          },
        ]
      : [];
  });
}

/** A board as the wire carries it. */
export const wireBoard = (
  { place, setup: _setup, ...board }: IntakeBoard,
  boards: readonly IntakeBoard[],
  types: readonly ItemTypeDef[],
): EmailIntakeBoard => ({ ...board, target: intakeTargetOf(place, boards, types) });
