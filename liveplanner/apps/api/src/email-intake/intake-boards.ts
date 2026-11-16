// The boards an address may belong to (docs/specs/026-plan/email-to-board.md "What a message makes"): each Plan board
// on the plan's tabs, with the first column a new card lands in and the first card type the board adds, as its own +
// would. An All Cards or archive board has no column for new cards.
import type { EmailIntakeBoard } from '@liveplanner/api-schema';
import { boardAddTypes, normaliseBoardSetup, type ItemTypeDef } from '@liveplanner/items';
import { publishable } from '../roadmap/roadmap-boards';
import { planTabs } from '../routes/plan-route';
import type { PlanEnv } from '../types';

/** A board as the dialog lists it, and where its new cards go (null: nowhere). */
export type IntakeBoard = EmailIntakeBoard & {
  place: { status: string; typeId: string } | null;
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
      const first = publishable(setup) ? setup.columns[0] : undefined;
      const type = boardAddTypes(setup, types)[0];
      boards.push({
        id: e.id,
        title: setup.title.trim() || 'Board',
        tabId: tab.id,
        tabName: tab.name,
        column: first && type ? first.name : null,
        place: first && type ? { status: first.status, typeId: type.id } : null,
      });
    }
  }
  return boards;
}

/** A board as the wire carries it. */
export const wireBoard = ({ place: _place, ...board }: IntakeBoard): EmailIntakeBoard => board;
