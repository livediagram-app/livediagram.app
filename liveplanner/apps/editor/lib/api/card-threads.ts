// A card's comment threads, as the editor reads and writes them (docs/specs/026-plan/items.md "Comments", blueprint
// item-store.md "Editor"). A cloud plan's go through the thread routes, which stamp every author themselves; a This
// Browser plan's apply the same pure writes to its own record (../offline/offline-threads.ts). A session on a
// tab-scoped link names its tab on every call.

import type { CardThreadWriteResponse, CardThreadsResponse } from '@liveplanner/api-schema';
import type { ItemPerson } from '@liveplanner/items';
import type { CardThread, CommentMention } from '@liveplanner/project';
import { isOfflineId } from '../offline/offline-store';
import { offlineFetchThreads, offlineWriteThread } from '../offline/offline-threads';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';
import type { ItemsScope } from './items';

export type ThreadAction =
  | { kind: 'start'; itemId: string; text: string; mentions?: CommentMention[] }
  | { kind: 'reply'; threadId: string; text: string; mentions?: CommentMention[] }
  | {
      kind: 'edit';
      threadId: string;
      commentId: string;
      text: string;
      mentions?: CommentMention[];
    }
  | { kind: 'delete'; threadId: string; commentId: string }
  | { kind: 'resolve'; threadId: string; resolved: boolean }
  | { kind: 'rename'; threadId: string; title: string }
  | { kind: 'addToCard'; threadId: string; itemId: string; projectId?: string }
  | { kind: 'deleteThread'; threadId: string };

// What a write changed: the thread as stored (null: it went), the comment a start, reply or edit wrote, or nothing
// at all (`unchanged`: a resolve already so, an edit that changed nothing).
export type ThreadAnswer = { thread: CardThread | null; commentId?: string } | { unchanged: true };

// Who is writing: their owner id (the author id the api stamps) and how items name them.
export type ThreadWriter = { ownerId: string; by: ItemPerson };

const enc = encodeURIComponent;

function url(scope: ItemsScope, rest: string): string {
  const q = scope.tabId ? `?tabId=${enc(scope.tabId)}` : '';
  return `${API_BASE}/projects/${enc(scope.projectId)}${rest}${q}`;
}

export async function fetchThreads(scope: ItemsScope): Promise<CardThread[]> {
  if (await isOfflineId(scope.projectId)) return offlineFetchThreads(scope.projectId);
  return fetchCloudThreads(scope);
}

// The server's threads, even while the id is still registered offline (Take Offline reads them before it keeps
// the plan, docs/specs/006-project/offline-mode.md).
export async function fetchCloudThreads(scope: ItemsScope): Promise<CardThread[]> {
  const res = await apiFetch(url(scope, '/threads'), {
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
  });
  return (await expectOk<CardThreadsResponse>(res, 'threads')).threads;
}

// The method, path and body of one action on the api.
function requestOf(action: ThreadAction): { method: string; path: string; body?: unknown } {
  const t = 'threadId' in action ? `/threads/${enc(action.threadId)}` : '';
  const comment = (a: { text: string; mentions?: CommentMention[] }) => ({
    text: a.text,
    ...(a.mentions?.length ? { mentions: a.mentions } : {}),
  });
  switch (action.kind) {
    case 'start':
      return {
        method: 'POST',
        path: `/items/${enc(action.itemId)}/threads`,
        body: comment(action),
      };
    case 'reply':
      return { method: 'POST', path: `${t}/comments`, body: comment(action) };
    case 'edit':
      return {
        method: 'PUT',
        path: `${t}/comments/${enc(action.commentId)}`,
        body: comment(action),
      };
    case 'delete':
      return { method: 'DELETE', path: `${t}/comments/${enc(action.commentId)}` };
    case 'resolve':
      return { method: 'POST', path: `${t}/${action.resolved ? 'resolve' : 'reopen'}` };
    case 'rename':
      return { method: 'PUT', path: `${t}/title`, body: { title: action.title } };
    case 'addToCard':
      return {
        method: 'POST',
        path: `${t}/cards`,
        body: {
          itemId: action.itemId,
          ...(action.projectId ? { projectId: action.projectId } : {}),
        },
      };
    case 'deleteThread':
      return { method: 'DELETE', path: t };
  }
}

/** Sends one thread action and answers what it changed. */
export async function writeThread(
  scope: ItemsScope,
  action: ThreadAction,
  who: ThreadWriter,
): Promise<ThreadAnswer> {
  if (await isOfflineId(scope.projectId)) return offlineWriteThread(scope.projectId, action, who);
  const req = requestOf(action);
  const res = await apiFetch(url(scope, req.path), {
    method: req.method,
    headers: await apiHeaders(scope.ownerId, {
      share: scope.shareCode,
      body: req.body !== undefined,
    }),
    ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
  });
  // A resolve already so, an edit that changed nothing; a thread's delete answers nothing either.
  if (res.status === 204) {
    return action.kind === 'deleteThread' ? { thread: null } : { unchanged: true };
  }
  return expectOk<CardThreadWriteResponse>(res, `thread ${action.kind}`);
}
