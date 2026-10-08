// Adding a Plan board (docs/specs/026-plan/plan-agents.md "Adding a board"): placed by placeBoard on the tab named,
// else the first tab holding a board, else the first tab, as one changeset through the api (live to anyone with
// the tab open). Card types are named as everywhere else.
import type { ApiClient } from '@livediagram/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type DocumentResponse,
  type TabResponse,
} from '@livediagram/api-schema';
import { placeBoard, resolveType, type BoardRequest } from '@livediagram/items';
import { apiRefusalOf } from './api-refusal';
import { readPlanState } from './plan-state';
import { tabPath } from '../verbs/shared';

export interface AddBoardInput extends Omit<BoardRequest, 'types'> {
  tabId?: string;
  // Card types by id or name.
  types?: readonly string[];
}

export type AddBoardResult =
  | {
      ok: true;
      tabId: string;
      elementId: string;
      title: string;
      columns: { name: string; status: string }[];
      // The card types it shows and takes, by name.
      takes: string[] | 'every type';
      changesetId: string | null;
      rev: number | null;
    }
  | { ok: false; code: string; message: string };

export async function addBoard(
  api: ApiClient,
  documentId: string,
  input: AddBoardInput,
  client: 'mcp' | 'cli',
): Promise<AddBoardResult> {
  try {
    const [{ document }, state] = await Promise.all([
      api.json<DocumentResponse>(`/documents/${encodeURIComponent(documentId)}`),
      readPlanState(api, documentId),
    ]);
    const first = [...document.tabs].sort((a, b) => a.orderIndex - b.orderIndex)[0];
    const tabId = input.tabId ?? state.plan.boards[0]?.tabId ?? first?.id;
    if (!tabId) return { ok: false, code: 'tab_unknown', message: 'That document has no tabs.' };
    if (!document.tabs.some((t) => t.id === tabId))
      return {
        ok: false,
        code: 'tab_unknown',
        message: `No tab "${tabId}". Tabs: ${document.tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
      };
    const types: string[] = [];
    for (const name of input.types ?? []) {
      const t = resolveType(name, state.plan.types);
      if (!t.ok) return t;
      types.push(t.type.id);
    }
    const { tab } = await api.json<TabResponse>(tabPath(documentId, tabId));
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
    const answer = await api.json<ChangesetResponse>(`${tabPath(documentId, tabId)}/changesets`, {
      method: 'POST',
      headers: { [CLIENT_HEADER]: client },
      body: JSON.stringify(body),
    });
    return {
      ok: true,
      tabId,
      elementId: placed.board.id,
      title: placed.board.planBoard.title,
      columns: placed.board.planBoard.columns.map((c) => ({ name: c.name, status: c.status })),
      takes: placed.board.planBoard.addTypes
        ? placed.board.planBoard.addTypes.map(
            (id) => state.plan.types.find((t) => t.id === id)?.label ?? id,
          )
        : 'every type',
      changesetId: answer.changeset?.id ?? null,
      rev: answer.changeset?.rev ?? null,
    };
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}
