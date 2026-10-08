// The item store's client (docs/specs/026-plan/items.md, blueprint item-store.md "Editor slice").
// Each call dispatches an offline document to its local store (../offline/offline-items) and a
// cloud document to the api. A session on a tab-scoped link names its tab on every call.

import type { ItemResponse, ItemsResponse } from '@livediagram/api-schema';
import {
  ITEM_BULK_MAX,
  type Item,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@livediagram/items';
import { createComment, type CommentMention } from '@livediagram/document';
import { isOfflineId } from '../offline/offline-store';
import {
  offlineFetchItems,
  offlineWriteItem,
  offlineWriteItemComment,
} from '../offline/offline-items';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk } from './core';

export type ItemsScope = {
  ownerId: string;
  documentId: string;
  shareCode: string | null;
  // The tab a tab-scoped link confines this session to; null for the whole document.
  tabId: string | null;
};

// What a write changed: the items as stored, the removed ids, and the store's rev (-1 when the
// answer does not say; the room's op carries it).
export type ItemWriteAnswer = { upserts: Item[]; removed: string[]; rev: number };

function itemsUrl(scope: ItemsScope, rest = ''): string {
  const q = scope.tabId ? `?tabId=${encodeURIComponent(scope.tabId)}` : '';
  return `${API_BASE}/documents/${encodeURIComponent(scope.documentId)}/items${rest}${q}`;
}

export async function fetchItems(scope: ItemsScope): Promise<ItemStoreState> {
  if (await isOfflineId(scope.documentId)) return offlineFetchItems(scope.documentId);
  const res = await apiFetch(itemsUrl(scope), {
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
  });
  const body = await expectOk<ItemsResponse>(res, 'items');
  const maxKey = Math.max(0, ...body.items.map((i) => i.key));
  return { items: body.items, rev: body.rev, nextKey: maxKey + 1 };
}

async function post<T>(scope: ItemsScope, rest: string, body: unknown, action: string): Promise<T> {
  const res = await apiFetch(itemsUrl(scope, rest), {
    method: 'POST',
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
    body: JSON.stringify(body),
  });
  return expectOk<T>(res, action);
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
  if (await isOfflineId(scope.documentId)) return offlineWriteItem(scope.documentId, write, by);
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
    case 'tally': {
      // One request per ITEM_BULK_MAX cards (a session vote's tally, as its host ends it).
      const answer: ItemWriteAnswer = { upserts: [], removed: [], rev: -1 };
      for (let i = 0; i < write.tallies.length; i += ITEM_BULK_MAX) {
        const r = await post<ItemsResponse>(
          scope,
          '/tally',
          { items: write.tallies.slice(i, i + ITEM_BULK_MAX) },
          'items tally',
        );
        answer.upserts.push(...r.items);
        answer.rev = r.rev;
      }
      return answer;
    }
    case 'patches': {
      // One request per ITEM_BULK_MAX items (a type's or a removed column's cards to the Trash).
      const answer: ItemWriteAnswer = { upserts: [], removed: [], rev: -1 };
      for (let i = 0; i < write.patches.length; i += ITEM_BULK_MAX) {
        const items = write.patches
          .slice(i, i + ITEM_BULK_MAX)
          .map(({ id: itemId, patch }) => ({ id: itemId, ...patch }));
        const r = await post<ItemsResponse>(
          scope,
          '/patches',
          undoBody({ items }, write.undo),
          'items change',
        );
        answer.upserts.push(...r.items);
        answer.rev = r.rev;
      }
      return answer;
    }
    case 'move':
      return one(await post(scope, `${id}/move`, undoBody(write.move, write.undo), 'item move'));
    case 'vote':
      return one(await post(scope, `${id}/vote`, { delta: write.delta }, 'item vote'));
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

// A card's comment change, as the editor asks for it (docs/specs/026-plan/items.md "Comments").
export type ItemCommentAction =
  | { kind: 'add'; text: string; mentions?: CommentMention[] }
  | { kind: 'delete'; commentId: string }
  | { kind: 'resolve'; resolved: boolean };

// Who is commenting: their owner id (the author id the api stamps) and how items name them.
export type ItemCommenter = { ownerId: string; by: ItemPerson };

// Sends one comment change: the item as stored, or null when it changed nothing. An offline document applies it
// to its record; a cloud one sends it to the api, which stamps the author itself.
export async function writeItemComment(
  scope: ItemsScope,
  itemId: string,
  action: ItemCommentAction,
  who: ItemCommenter,
): Promise<ItemWriteAnswer | null> {
  if (await isOfflineId(scope.documentId)) {
    const change =
      action.kind === 'add'
        ? {
            kind: 'add' as const,
            comment: createComment(
              action.text,
              { id: who.ownerId, name: who.by.name, color: who.by.color },
              action.mentions,
            ),
          }
        : action.kind === 'delete'
          ? { kind: 'remove' as const, commentId: action.commentId }
          : action;
    return offlineWriteItemComment(scope.documentId, itemId, change, who.by);
  }
  const base = `/${encodeURIComponent(itemId)}/comments`;
  if (action.kind === 'add') {
    const body = {
      text: action.text,
      ...(action.mentions?.length ? { mentions: action.mentions } : {}),
    };
    return one(await post(scope, base, body, 'item comment'));
  }
  const res = await apiFetch(
    itemsUrl(
      scope,
      action.kind === 'delete'
        ? `${base}/${encodeURIComponent(action.commentId)}`
        : `${base}/${action.resolved ? 'resolve' : 'reopen'}`,
    ),
    {
      method: action.kind === 'delete' ? 'DELETE' : 'POST',
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
    },
  );
  // A resolve that changed nothing answers 204.
  if (res.status === 204) return null;
  return one(await expectOk<ItemResponse>(res, 'item comment'));
}
