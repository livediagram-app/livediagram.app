// Changing a Plan board (docs/specs/026-plan/plan-agents.md "Changing a board"): its title, its columns by name and
// the card types it takes, as one changeset on the board element (reshapeBoard), revertible like any agent edit.
// A board is named by its title, or its element id when two share a title.
import type { ApiClient } from '@liveworkspace/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type TabResponse,
} from '@liveplanner/api-schema';
import { elementFingerprint } from '@liveplanner/project';
import {
  CARD_FIELD_LABELS,
  SWIMLANE_BY,
  boardAddTypes,
  boardSortNamed,
  boardSortText,
  laneFieldsOf,
  type ItemTypeDef,
  normaliseBoardSetup,
  isDoneColumn,
  planBoardWidthFor,
  reshapeBoard,
  resolveType,
  statusKey,
  type BoardChange,
  type CardSize,
  type PlanBoardOutline,
} from '@liveplanner/items';
import { apiRefusalOf } from './api-refusal';
import { readPlanState } from './plan-state';
import { tabPath } from '../verbs/shared';

interface ChangeBoardInput extends Omit<BoardChange, 'types' | 'swimlanes' | 'sortBy'> {
  // Sort Cards by field name or id; an empty list turns it off.
  sortBy?: readonly { field: string; direction?: 'ascending' | 'descending' | undefined }[];
  // Its swimlanes, as the board's menu names them: none, assignee, type, priority, status (or "column"), or a field
  // by name ("Severity").
  swimlanes?: string;
  // The board: its title, or its element id.
  board: string;
  // Card types by id or name; an empty list takes none (as the editor's last type turned off does), and
  // EVERY_TYPE shows every type again.
  types?: readonly string[] | typeof EVERY_TYPE;
}

// What a board that names no card types takes, in answers, and what change_board takes to show every type again.
export const EVERY_TYPE = 'every type';

type ChangeBoardResult =
  | {
      ok: true;
      tabId: string;
      elementId: string;
      title: string;
      columns: { name: string; status: string; done?: true }[];
      takes: string[] | 'every type';
      cardSize: CardSize;
      cardFields: string[];
      sortBy: string[];
      changesetId: string | null;
      rev: number | null;
    }
  | { ok: false; code: string; message: string };

// A board's swimlanes by name: a built-in grouping, else a field any card type has that rows can group by.
export function swimlanesNamed(
  name: string,
  types: readonly ItemTypeDef[],
):
  | { ok: true; value: NonNullable<BoardChange['swimlanes']> }
  | { ok: false; code: string; message: string } {
  const key = statusKey(name);
  const by = key === 'column' ? 'status' : SWIMLANE_BY.find((b) => b !== 'field' && b === key);
  if (by) return { ok: true, value: { by } };
  const fields = laneFieldsOf(types);
  const field = fields.find((f) => statusKey(f.label) === key || f.id === name);
  if (field) return { ok: true, value: { by: 'field', field: field.id } };
  return {
    ok: false,
    code: 'board_invalid',
    message:
      `No swimlanes "${name}". Swimlanes: none, assignee, type, priority, status` +
      `${fields.length ? `, or a field: ${fields.map((f) => f.label).join(', ')}` : ''}.`,
  };
}

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
      : 'The plan has no board yet: add one with add_board.',
  };
}

export async function changeBoard(
  api: ApiClient,
  projectId: string,
  input: ChangeBoardInput,
  client: 'mcp' | 'cli',
): Promise<ChangeBoardResult> {
  try {
    const state = await readPlanState(api, projectId);
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
    let swimlanes: BoardChange['swimlanes'];
    if (input.swimlanes !== undefined) {
      const lanes = swimlanesNamed(input.swimlanes, state.plan.types);
      if (!lanes.ok) return lanes;
      swimlanes = lanes.value;
    }
    const { tab } = await api.json<TabResponse>(tabPath(projectId, tabId));
    const element = tab.elements.find((e) => e.id === elementId);
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
    // Sort Cards names the fields the board's own card types offer.
    let sortBy: BoardChange['sortBy'];
    if (input.sortBy) {
      const named = boardSortNamed(input.sortBy, boardAddTypes(setup, state.plan.types));
      if (!named.ok) return named;
      sortBy = named.sortBy;
    }
    const reshaped = reshapeBoard(
      setup,
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.renameColumns ? { renameColumns: input.renameColumns } : {}),
        ...(input.cardSize ? { cardSize: input.cardSize } : {}),
        ...(swimlanes ? { swimlanes } : {}),
        ...(input.doneColumn !== undefined ? { doneColumn: input.doneColumn } : {}),
        ...(input.doneColumns ? { doneColumns: input.doneColumns } : {}),
        ...(input.cardFields ? { cardFields: input.cardFields } : {}),
        ...(sortBy ? { sortBy } : {}),
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
    const answer = await api.json<ChangesetResponse>(`${tabPath(projectId, tabId)}/changesets`, {
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
      columns: reshaped.setup.columns.map((c) => ({
        name: c.name,
        status: c.status,
        ...(isDoneColumn(reshaped.setup, c) ? { done: true as const } : {}),
      })),
      takes: reshaped.setup.addTypes ? reshaped.setup.addTypes.map(label) : 'every type',
      cardSize: reshaped.setup.cardSize ?? 'detailed',
      // A board's card fields are built-in fields only (normaliseBoardSetup keeps CARD_FIELDS alone).
      cardFields: reshaped.setup.cardFields.map(
        (f) => CARD_FIELD_LABELS[f as keyof typeof CARD_FIELD_LABELS],
      ),
      sortBy: boardSortText(reshaped.setup.sortBy, state.plan.types),
      changesetId: answer.changeset?.id ?? null,
      rev: answer.changeset?.rev ?? null,
    };
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}
