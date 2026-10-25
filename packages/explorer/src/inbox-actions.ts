// The Inbox's verbs, built once for every page that shows it (one-explorer-contracts.md "Inbox", "What the reading
// pane can do"). A host hands in what its page can reach and gets `InboxActions` back:
//
// - `api(app)`: a way to call that app's api as the person, or null where this page's token can't write that app's
//   items. With it, an element's thread replies and resolves through the app's comment routes
//   (`POST /<items>/:id/tabs/:tabId/comments`, `…/comments/:commentId/resolve`, the thread named by its first
//   comment, read from `GET /<items>/:id/comments?status=all`), and a Plan card's thread through its card's
//   (`POST /projects/:id/items/:cardId/comments`, `…/comments/resolve`). The same read gives the pane the thread.
// - `openAction`: the item and tab the editor has open, and its own Mark Done. An element's action has no route of
//   its own (an action's status is the people's to change, in the editor), so it is offered only there.
//
// Rows from items only this browser holds are never acted on here: nothing on these pages reaches that store. A
// Plan card is never marked done here either: done is a board's column, which the Inbox doesn't know.

import type { App } from '@liveworkspace/index-client';
import { APP_ITEMS, isAppName } from '@liveworkspace/sites';
import type { InboxActions, InboxComment, InboxTarget, InboxVerb } from './types';

/** A call to one app's api as the person: `path` is under its `/api` (`/documents/…`), `body` sent as JSON. */
export type InboxApi = (
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal },
) => Promise<Response>;

export type InboxActionsOptions = {
  api?: (app: App) => InboxApi | null;
  openAction?: {
    itemId: string;
    tabId: string;
    markDone: (elementId: string, actionId: string) => void;
  } | null;
};

type ListedThread = {
  tabId: string;
  elementId: string;
  resolved: boolean;
  comments: {
    id: string;
    text: string;
    createdAt: number;
    authorName: string;
    authorColor: string;
    authorId?: string;
  }[];
};

const NONE: readonly InboxVerb[] = [];
const THREAD_VERBS: readonly InboxVerb[] = ['reply', 'resolve'];
const DONE: readonly InboxVerb[] = ['done'];

// An item's threads, read once and kept briefly: the pane's thread and Resolve's first comment share one read.
const LIST_TTL_MS = 30_000;
const LIST_MAX = 16;

const enc = encodeURIComponent;

function itemsPath(app: App): string | null {
  return isAppName(app) ? `/${APP_ITEMS[app].apiNoun}s` : null;
}

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`inbox action: ${res.status}`);
  return res;
}

export function createInboxActions({ api, openAction }: InboxActionsOptions): InboxActions {
  const lists = new Map<string, { at: number; read: Promise<ListedThread[]> }>();

  const caller = (t: InboxTarget): { call: InboxApi; base: string } | null => {
    if (t.local) return null;
    const call = api?.(t.app) ?? null;
    const items = itemsPath(t.app);
    return call && items ? { call, base: `${items}/${enc(t.itemId)}` } : null;
  };

  const listOf = (t: InboxTarget, signal?: AbortSignal): Promise<ListedThread[]> => {
    const c = caller(t);
    if (!c) return Promise.reject(new Error('inbox action: not here'));
    const key = `${t.app}:${t.itemId}`;
    const held = lists.get(key);
    if (held && Date.now() - held.at < LIST_TTL_MS) return held.read;
    const read = c
      .call(`${c.base}/comments?status=all`, { method: 'GET', signal })
      .then(ok)
      .then((r) => r.json() as Promise<{ threads?: ListedThread[] }>)
      .then((b) => (Array.isArray(b.threads) ? b.threads : []));
    lists.set(key, { at: Date.now(), read });
    if (lists.size > LIST_MAX) lists.delete(lists.keys().next().value as string);
    read.catch(() => lists.delete(key));
    return read;
  };

  const threadOf = async (t: InboxTarget, signal?: AbortSignal) =>
    (await listOf(t, signal)).find((x) => x.tabId === t.tabId && x.elementId === t.elementId) ??
    null;

  const forget = (t: InboxTarget) => lists.delete(`${t.app}:${t.itemId}`);

  return {
    offers: (t) => {
      if (t.local) return NONE;
      switch (t.kind) {
        case 'Thread':
        case 'CardThread':
          return caller(t) ? THREAD_VERBS : NONE;
        case 'Action':
          return openAction && t.itemId === openAction.itemId && t.tabId === openAction.tabId
            ? DONE
            : NONE;
        case 'Card':
          return NONE;
      }
    },
    reply: async (t, text) => {
      const c = caller(t);
      if (!c) throw new Error('inbox action: not here');
      if (t.kind === 'CardThread') {
        await c
          .call(`${c.base}/items/${enc(t.elementId)}/comments`, { method: 'POST', body: { text } })
          .then(ok);
      } else {
        await c
          .call(`${c.base}/tabs/${enc(t.tabId)}/comments`, {
            method: 'POST',
            body: { elementId: t.elementId, text },
          })
          .then(ok);
      }
      forget(t);
    },
    resolve: async (t) => {
      const c = caller(t);
      if (!c) throw new Error('inbox action: not here');
      if (t.kind === 'CardThread') {
        await c
          .call(`${c.base}/items/${enc(t.elementId)}/comments/resolve`, { method: 'POST' })
          .then(ok);
      } else {
        // A thread is named by its first comment.
        const first = (await threadOf(t))?.comments[0]?.id;
        if (!first) throw new Error('inbox action: no such thread');
        await c
          .call(`${c.base}/tabs/${enc(t.tabId)}/comments/${enc(first)}/resolve`, {
            method: 'POST',
          })
          .then(ok);
      }
      forget(t);
    },
    done: async (t) => {
      if (!openAction || t.itemId !== openAction.itemId || t.tabId !== openAction.tabId) {
        throw new Error('inbox action: not open here');
      }
      openAction.markDone(t.elementId, t.actionId ?? t.elementId);
    },
    loadThread: async (t, signal) => {
      // A card's comments come with the plan's whole card list: too much to read for one pane.
      if (t.kind !== 'Thread' || !caller(t)) return null;
      const thread = await threadOf(t, signal);
      if (!thread) return null;
      return thread.comments.map((c): InboxComment => ({
        id: c.id,
        authorName: c.authorName || null,
        authorColor: c.authorColor || undefined,
        // The api names the author only on the caller's own comments.
        mine: Boolean(c.authorId),
        text: c.text,
        at: c.createdAt,
      }));
    },
  };
}
