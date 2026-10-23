// Adding a Plan board (docs/specs/026-plan/plan-agents.md "Adding a board"): placed by placeBoard on the tab named,
// else the first tab holding a board, else the first tab, which must be in Plan, as one changeset through the api (live to anyone with
// the tab open). Card types are named as everywhere else.
import type { ApiClient } from '@liveplanner/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type ProjectResponse,
  type TabResponse,
} from '@liveplanner/api-schema';
import {
  READY_MADE_CARD_TYPES,
  placeBoard,
  resolveType,
  type BoardRequest,
} from '@liveplanner/items';
import { apiRefusalOf } from './api-refusal';
import { bringBoardCardTypes } from './brought-types';
import { readPlanState } from './plan-state';
import { tabPath } from '../verbs/shared';

interface AddBoardInput extends Omit<BoardRequest, 'types'> {
  tabId?: string;
  // Card types by id or name.
  types?: readonly string[];
}

type AddBoardResult =
  | {
      ok: true;
      tabId: string;
      elementId: string;
      title: string;
      columns: { name: string; status: string }[];
      // The card types it shows and takes, by name.
      takes: string[] | 'every type';
      // The card types the project gained with it (a Bug Triage board's Bug), by name.
      brought: string[];
      changesetId: string | null;
      rev: number | null;
    }
  | { ok: false; code: string; message: string };

export async function addBoard(
  api: ApiClient,
  projectId: string,
  input: AddBoardInput,
  client: 'mcp' | 'cli',
): Promise<AddBoardResult> {
  try {
    const [{ project }, state] = await Promise.all([
      api.json<ProjectResponse>(`/projects/${encodeURIComponent(projectId)}`),
      readPlanState(api, projectId),
    ]);
    const first = [...project.tabs].sort((a, b) => a.orderIndex - b.orderIndex)[0];
    const tabId = input.tabId ?? state.plan.boards[0]?.tabId ?? first?.id;
    if (!tabId) return { ok: false, code: 'tab_unknown', message: 'That plan has no tabs.' };
    if (!project.tabs.some((t) => t.id === tabId))
      return {
        ok: false,
        code: 'tab_unknown',
        message: `No tab "${tabId}". Tabs: ${project.tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
      };
    const types: string[] = [];
    for (const name of input.types ?? []) {
      const t = resolveType(name, state.plan.types);
      if (!t.ok) return t;
      types.push(t.type.id);
    }
    const { tab } = await api.json<TabResponse>(tabPath(projectId, tabId));
    const placed = placeBoard(
      { ...input, ...(input.types ? { types } : {}) },
      tab.elements,
      state.plan.statuses,
      crypto.randomUUID(),
    );
    if (!placed.ok) return placed;
    const body: ChangesetRequest = {
      operations: [{ op: 'add', element: placed.board }],
      base: { rev: tab.rev, elements: {} },
      summary: `Add the ${placed.board.planBoard.title} board`,
    };
    const answer = await api.json<ChangesetResponse>(`${tabPath(projectId, tabId)}/changesets`, {
      method: 'POST',
      headers: { [CLIENT_HEADER]: client },
      body: JSON.stringify(body),
    });
    const brought = await bringBoardCardTypes(api, projectId, [placed.board], {
      stored: project.itemTypes ?? null,
      ...(project.itemTypesRev !== undefined ? { rev: project.itemTypesRev } : {}),
    });
    // Named as the project names them, else as the ready-made type it just gained (a board's types are always one
    // or the other).
    const known = [...state.plan.types, ...READY_MADE_CARD_TYPES];
    const labels = (ids: readonly string[]) =>
      ids.flatMap((id) =>
        known
          .filter((t) => t.id === id)
          .slice(0, 1)
          .map((t) => t.label),
      );
    return {
      ok: true,
      tabId,
      elementId: placed.board.id,
      title: placed.board.planBoard.title,
      columns: placed.board.planBoard.columns.map((c) => ({ name: c.name, status: c.status })),
      takes: placed.board.planBoard.addTypes
        ? labels(placed.board.planBoard.addTypes)
        : 'every type',
      brought: labels(brought),
      changesetId: answer.changeset?.id ?? null,
      rev: answer.changeset?.rev ?? null,
    };
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}
