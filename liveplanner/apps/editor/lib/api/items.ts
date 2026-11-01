// The item store's client (docs/specs/026-plan/items.md, blueprint item-store.md "Editor slice").
// Each call dispatches an offline project to its local store (../offline/offline-items) and a
// cloud project to the api. A session on a tab-scoped link names its tab on every call.

import type { ItemResponse, ItemsResponse } from '@liveplanner/api-schema';
import {
  ITEM_BULK_MAX,
  type Item,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@liveplanner/items';
import { isOfflineId } from '../offline/offline-store';
import { offlineFetchItems, offlineWriteItem } from '../offline/offline-items';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk } from './core';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

export type ItemsScope = {
  ownerId: string;
  projectId: string;
  shareCode: string | null;
  // The tab a tab-scoped link confines this session to; null for the whole project.
  tabId: string | null;
};

// What a write changed: the items as stored, the removed ids, and the store's rev (-1 when the
// answer does not say; the room's op carries it).
export type ItemWriteAnswer = { upserts: Item[]; removed: string[]; rev: number };

// A write that failed after part of it landed (a many-item change, docs/specs/026-plan/blueprints/item-store.md
// "Interfaces and contracts: REST"): what landed, so the editor keeps it and can undo it. `code` is the refusal's.
export class ItemWritePartlyLanded extends Error {
  readonly code: string | null;
  readonly landed: ItemWriteAnswer;
  constructor(landed: ItemWriteAnswer, failure: unknown) {
    super(failure instanceof Error ? failure.message : String(failure));
    this.name = 'ItemWritePartlyLanded';
    this.code = (failure as { code?: string } | null)?.code ?? null;
    this.landed = landed;
  }
}

function itemsUrl(scope: ItemsScope, rest = ''): string {
  const q = scope.tabId ? `?tabId=${encodeURIComponent(scope.tabId)}` : '';
  return `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/items${rest}${q}`;
}

export async function fetchItems(scope: ItemsScope): Promise<ItemStoreState> {
  if (await isOfflineId(scope.projectId)) return offlineFetchItems(scope.projectId);
  return fetchCloudItems(scope);
}

// The server's item store, even while the id is still registered offline: Sync Project checks
// the cloud copy holds every card before it removes the local one (docs/specs/006-project/offline-mode.md).
export async function fetchCloudItems(scope: ItemsScope): Promise<ItemStoreState> {
  const res = await apiFetch(itemsUrl(scope), {
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
  });
  const body = await expectOk<ItemsResponse>(res, 'items');
  const maxKey = Math.max(0, ...body.items.map((i) => i.key));
  return { items: body.items, rev: body.rev, nextKey: maxKey + 1 };
}

// A write the store answered `item_busy` (a burst of writes racing for its keys or revs, the api's own retries
// spent, nothing landed) is sent again after a short, jittered pause, so a quick run of new cards keeps every
// one (docs/specs/026-plan/items.md "Changing items").
export const ITEM_BUSY_RETRIES = 3;
const ITEM_BUSY_PAUSE_MS = 80;

async function refusalCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

async function post<T>(scope: ItemsScope, rest: string, body: unknown, action: string): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const res = await apiFetch(itemsUrl(scope, rest), {
      method: 'POST',
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
      body: JSON.stringify(body),
    });
    if (
      res.status === 409 &&
      attempt <= ITEM_BUSY_RETRIES &&
      (await refusalCode(res)) === 'item_busy'
    ) {
      debugLog('[items] items.write.busy-retry', { action, attempt });
      await new Promise((r) => setTimeout(r, ITEM_BUSY_PAUSE_MS * attempt * (0.5 + Math.random())));
      continue;
    }
    return expectOk<T>(res, action);
  }
}

// The items a refused many-item request still landed (its body's `items`, the api's partial answer), or none.
async function landedOf(res: Response): Promise<ItemsResponse | null> {
  try {
    const body = (await res.clone().json()) as Partial<ItemsResponse>;
    return Array.isArray(body.items) && typeof body.rev === 'number'
      ? { items: body.items, rev: body.rev }
      : null;
  } catch {
    return null;
  }
}

// Sends a change of many items, a request per ITEM_BULK_MAX of them. A failure after any of them landed (an earlier
// request, or the failed one's partial answer) throws ItemWritePartlyLanded with what landed.
async function postInChunks(
  scope: ItemsScope,
  path: '/patches' | '/moves' | '/tally',
  entries: readonly object[],
  action: string,
  undo?: true,
  // What every request carries beside its items (a tally's Votes field).
  extra: Record<string, unknown> = {},
): Promise<ItemWriteAnswer> {
  const answer: ItemWriteAnswer = { upserts: [], removed: [], rev: -1 };
  for (let i = 0; i < entries.length; i += ITEM_BULK_MAX) {
    const items = entries.slice(i, i + ITEM_BULK_MAX);
    const res = await apiFetch(itemsUrl(scope, path), {
      method: 'POST',
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
      body: JSON.stringify(undoBody({ items, ...extra }, undo)),
    });
    const partial = res.ok ? null : await landedOf(res);
    try {
      const r = await expectOk<ItemsResponse>(res, action);
      answer.upserts.push(...r.items);
      answer.rev = r.rev;
    } catch (err) {
      if (partial) {
        answer.upserts.push(...partial.items);
        answer.rev = partial.rev;
      }
      if (answer.upserts.length === 0) throw err;
      throw new ItemWritePartlyLanded(answer, err);
    }
  }
  return answer;
}

const one = (r: ItemResponse): ItemWriteAnswer => ({ upserts: [r.item], removed: [], rev: r.rev });

// Sends one write. `by` signs an offline write; the api signs a cloud one itself.
// A patch or move body, flagged `undo: true` when it is an undo or redo (the api then lets it into a status the
// card's type leaves out, docs/specs/026-plan/item-types.md "An item type").
function undoBody<T extends object>(body: T, undo: true | undefined): T | (T & { undo: true }) {
  return undo ? { ...body, undo: true } : body;
}

export async function writeItem(
  scope: ItemsScope,
  write: ItemWrite,
  by: ItemPerson,
): Promise<ItemWriteAnswer> {
  if (await isOfflineId(scope.projectId)) return offlineWriteItem(scope.projectId, write, by);
  const id = 'id' in write ? `/${encodeURIComponent(write.id)}` : '';
  switch (write.kind) {
    case 'create': {
      if (write.creates.length === 1)
        return one(await post(scope, '', write.creates[0], 'item create'));
      const answer: ItemWriteAnswer = { upserts: [], removed: [], rev: -1 };
      for (let i = 0; i < write.creates.length; i += ITEM_BULK_MAX) {
        const r = await post<ItemsResponse>(
          scope,
          '/bulk',
          { items: write.creates.slice(i, i + ITEM_BULK_MAX) },
          'items create',
        );
        answer.upserts.push(...r.items);
        answer.rev = r.rev;
      }
      return answer;
    }
    case 'patch':
      return one(await post(scope, id, undoBody(write.patch, write.undo), 'item change'));
    case 'tally':
      // A session vote's tally, as its host ends it, in the Votes field it counts in (session-tools.md "Count In").
      return postInChunks(
        scope,
        '/tally',
        write.tallies,
        'items tally',
        undefined,
        write.field ? { field: write.field } : {},
      );
    case 'patches':
      // A type's or a removed column's cards to the Trash.
      return postInChunks(
        scope,
        '/patches',
        write.patches.map(({ id: itemId, patch }) => ({ id: itemId, ...patch })),
        'items change',
        write.undo,
      );
    case 'move':
      return one(await post(scope, `${id}/move`, undoBody(write.move, write.undo), 'item move'));
    case 'moves':
      // A group of cards moved together, in order (docs/specs/026-plan/items.md "Move many"): a chunk's first move names
      // the last card of the chunk before, which has landed.
      return postInChunks(
        scope,
        '/moves',
        write.moves.map(({ id: itemId, move }) => ({ id: itemId, ...move })),
        'items move',
        write.undo,
      );
    // A time write to a Time Spent field (docs/specs/026-plan/item-types.md "Time Spent"); a no-op answers rev -1.
    case 'time':
      return one(await post(scope, `${id}/time`, { field: write.field, ...write.op }, 'item time'));
    case 'delete': {
      await apiDelete(itemsUrl(scope, id), scope.ownerId, {
        action: 'item delete',
        share: scope.shareCode,
        allow404: false,
      });
      return { upserts: [], removed: [write.id], rev: -1 };
    }
  }
}
