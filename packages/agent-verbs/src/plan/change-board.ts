// Changing a Plan board (docs/specs/026-plan/plan-agents.md "Changing a board"): its title, its columns by name and
// the card types it takes, as one changeset on the board element (reshapeBoard), revertible like any agent edit.
// A board is named by its title, or its element id when two share a title.
import type { ApiClient } from '@livediagram/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type TabResponse,
} from '@livediagram/api-schema';
import { elementFingerprint, type Element } from '@livediagram/document';
import {
  normaliseBoardSetup,
  planBoardWidthFor,
  reshapeBoard,
  resolveType,
  statusKey,
  type BoardChange,
  type PlanBoardOutline,
} from '@livediagram/items';
import { apiRefusalOf } from './api-refusal';
import { readPlanState } from './plan-state';
import { tabPath } from '../verbs/shared';

export interface ChangeBoardInput extends Omit<BoardChange, 'types'> {
  // The board: its title, or its element id.
  board: string;
  // Card types by id or name; an empty list takes none (as the editor's last type turned off does), and
  // EVERY_TYPE shows every type again.
  types?: readonly string[] | typeof EVERY_TYPE;
}

// What a board that names no card types takes, in answers, and what change_board takes to show every type again.
export const EVERY_TYPE = 'every type';

export type ChangeBoardResult =
  | {
      ok: true;
      tabId: string;
      elementId: string;
      title: string;
      columns: { name: string; status: string }[];
      takes: string[] | 'every type';
      changesetId: string | null;
      rev: number | null;
    }
  | { ok: false; code: string; message: string };

const describe = (b: PlanBoardOutline) => `"${b.title}" on ${b.tabName} (${b.elementId})`;

export function resolveBoard(
  input: string,
  boards: readonly PlanBoardOutline[],
): { ok: true; board: PlanBoardOutline } | { ok: false; code: string; message: string } {
  const byId = boards.find((b) => b.elementId === input);
  if (byId) return { ok: true, board: byId };
  const named = boards.filter((b) => statusKey(b.title) === statusKey(input));
  if (named.length === 1) return { ok: true, board: named[0]! };
  if (named.length > 1)
    return {
      ok: false,
      code: 'board_ambiguous',
      message: `"${input}" names more than one board: ${named.map(describe).join('; ')}. Name it by its id.`,
    };
  return {
    ok: false,
    code: 'board_unknown',
    message: boards.length
      ? `No board "${input}". Boards: ${boards.map(describe).join('; ')}.`
      : 'The document has no Plan board yet: add one with add_board.',
  };
}

export async function changeBoard(
  api: ApiClient,
  documentId: string,
  input: ChangeBoardInput,
  client: 'mcp' | 'cli',
): Promise<ChangeBoardResult> {
  try {
    const state = await readPlanState(api, documentId);
    const found = resolveBoard(input.board, state.plan.boards);
    if (!found.ok) return found;
    const { tabId, elementId } = found.board;
    let types: string[] | null | undefined;
    if (input.types === EVERY_TYPE) types = null;
    else if (input.types) {
      types = [];
      for (const name of input.types) {
        const t = resolveType(name, state.plan.types);
        if (!t.ok) return t;
        types.push(t.type.id);
      }
    }
    const { tab } = await api.json<TabResponse>(tabPath(documentId, tabId));
    const element = (tab.elements as Element[]).find((e) => e.id === elementId);
    const setup =
      element?.type === 'shape' && 'planBoard' in element
        ? normaliseBoardSetup(element.planBoard)
        : null;
    if (element?.type !== 'shape' || !setup)
      return {
        ok: false,
        code: 'board_unknown',
        message: 'That board changed since it was read: list_items again.',
      };
    const reshaped = reshapeBoard(
      setup,
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.columns ? { columns: input.columns } : {}),
        ...(types !== undefined ? { types } : {}),
      },
      state.plan.statuses,
    );
    if (!reshaped.ok) return reshaped;
    const width = Math.max(element.width, planBoardWidthFor(reshaped.setup));
    const body: ChangesetRequest = {
      operations: [
        {
          op: 'set',
          target: `id:${JSON.stringify(elementId)}`,
          fields: { planBoard: reshaped.setup, ...(width !== element.width ? { width } : {}) },
        },
      ],
      base: { rev: tab.rev, elements: { [elementId]: elementFingerprint(element) } },
      summary: `Change the ${reshaped.setup.title} board`,
    };
    const answer = await api.json<ChangesetResponse>(`${tabPath(documentId, tabId)}/changesets`, {
      method: 'POST',
      headers: { [CLIENT_HEADER]: client },
      body: JSON.stringify(body),
    });
    const label = (id: string) => state.plan.types.find((t) => t.id === id)?.label ?? id;
    return {
      ok: true,
      tabId,
      elementId,
      title: reshaped.setup.title,
      columns: reshaped.setup.columns.map((c) => ({ name: c.name, status: c.status })),
      takes: reshaped.setup.addTypes ? reshaped.setup.addTypes.map(label) : 'every type',
      changesetId: answer.changeset?.id ?? null,
      rev: answer.changeset?.rev ?? null,
    };
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}
