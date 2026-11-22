// The Inbox's verbs, built once for every page that shows it (one-explorer-contracts.md "Inbox", "What the reading
// pane can do"). A host hands in what its page can reach and gets `InboxActions` back:
//
// - `api(app)`: a way to call that app's api as the person, or null where this page's token can't write that app's
//   items. With it, an element's thread replies and resolves through the app's comment routes
//   (`POST /<items>/:id/tabs/:tabId/comments`, `…/comments/:commentId/resolve`, the thread named by its first
//   comment, read from `GET /<items>/:id/comments?status=all`), and a Plan card's thread through the thread routes
//   (`POST /projects/:id/threads/:threadId/comments`, `…/threads/:threadId/resolve`). The same read gives the pane
//   the thread. A part of an element with its own thread (a liveplanner Sheet cell) is the row `<elementId>:<cell>`
//   (one-explorer-contracts.md "What an item pushes"): found in the listing by `listedThreadKey`, and replied to with
//   the listed thread's own element and cell.
// - `openAction`: the item and tab the editor has open, and its own Mark Done, used there so the canvas changes in
//   place. Anywhere else an element's action is marked done through the app's action route
//   (`POST /<items>/:id/tabs/:tabId/actions/:actionId/status`, livediagram's), which the open editors hear live.
//
// - A suggested edit (liveknowledge) is accepted or dismissed through the app's suggestion routes,
//   `POST /<items>/:id/suggestions/:suggestionId/accept` and `…/dismiss`, with the same `api(app)`. A refusal throws
//   `InboxActionError` with the status and the body's code, so the pane can say why (403, 409 `suggestion_stale`).
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
  // A Sheet cell's thread: its cell key.
  cell?: string;
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
const SUGGESTION_VERBS: readonly InboxVerb[] = ['accept', 'dismiss'];

/** A verb the app refused: its status and the error code its body named (`{ error }` or `{ code }`), null for
 *  none. */
export class InboxActionError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null) {
    super(`inbox action: ${status}${code ? ` ${code}` : ''}`);
    this.name = 'InboxActionError';
    this.status = status;
    this.code = code;
  }
}

// A refusal's code, from a JSON body of `{ error }` or `{ code }`; null when it has none.
async function refusalOf(res: Response): Promise<InboxActionError> {
  let code: string | null = null;
  try {
    const b = (await res.json()) as { error?: unknown; code?: unknown } | null;
    const said = b?.error ?? b?.code;
    if (typeof said === 'string') code = said;
  } catch {
    // Not JSON: the status alone.
  }
  return new InboxActionError(res.status, code);
}

// An item's threads, read once and kept briefly: the pane's thread and Resolve's first comment share one read.
const LIST_TTL_MS = 30_000;
const LIST_MAX = 16;

const enc = encodeURIComponent;

// The apps whose api marks an element's action done (livediagram's canvases). A Plan card's done is a board column.
const ACTION_ROUTE_APPS: ReadonlySet<App> = new Set<App>(['livediagram']);
const actionRoutes = (app: App) => ACTION_ROUTE_APPS.has(app);

function itemsPath(app: App): string | null {
  return isAppName(app) ? `/${APP_ITEMS[app].apiNoun}s` : null;
}

/** The Inbox row's `elementId` a listed thread is pushed under: its element's, then `:cell` for a part's. */
export function listedThreadKey(t: { elementId: string; cell?: string }): string {
  return t.cell ? `${t.elementId}:${t.cell}` : t.elementId;
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
    (await listOf(t, signal)).find(
      (x) => x.tabId === t.tabId && listedThreadKey(x) === t.elementId,
    ) ?? null;

  const isOpenHere = (t: InboxTarget) =>
    !!openAction && t.itemId === openAction.itemId && t.tabId === openAction.tabId;

  const forget = (t: InboxTarget) => lists.delete(`${t.app}:${t.itemId}`);

  // A suggested edit (`elementId` its id) accepted or dismissed; a refusal says its status and code.
  const answerSuggestion = async (t: InboxTarget, verb: 'accept' | 'dismiss') => {
    const c = caller(t);
    if (!c || t.kind !== 'Suggestion') throw new Error('inbox action: not here');
    const res = await c.call(`${c.base}/suggestions/${enc(t.elementId)}/${verb}`, {
      method: 'POST',
    });
    if (!res.ok) throw await refusalOf(res);
  };

  return {
    offers: (t) => {
      if (t.local) return NONE;
      switch (t.kind) {
        case 'Thread':
        case 'CardThread':
          return caller(t) ? THREAD_VERBS : NONE;
        case 'Action':
          return isOpenHere(t) || (caller(t) && actionRoutes(t.app)) ? DONE : NONE;
        case 'Card':
          return NONE;
        case 'Suggestion':
          return caller(t) ? SUGGESTION_VERBS : NONE;
      }
    },
    reply: async (t, text) => {
      const c = caller(t);
      if (!c) throw new Error('inbox action: not here');
      if (t.kind === 'CardThread') {
        await c
          .call(`${c.base}/threads/${enc(t.elementId)}/comments`, {
            method: 'POST',
            body: { text },
          })
          .then(ok);
      } else {
        // A part's key holds a colon: its thread names its element and part, from the listing (read once, and kept
        // for the pane). A plain element's id is posted as it is, with no read.
        const listed = t.elementId.includes(':') ? await threadOf(t).catch(() => null) : null;
        const at = listed?.cell
          ? { elementId: listed.elementId, cell: listed.cell }
          : { elementId: t.elementId };
        await c
          .call(`${c.base}/tabs/${enc(t.tabId)}/comments`, {
            method: 'POST',
            body: { ...at, text },
          })
          .then(ok);
      }
      forget(t);
    },
    resolve: async (t) => {
      const c = caller(t);
      if (!c) throw new Error('inbox action: not here');
      if (t.kind === 'CardThread') {
        await c.call(`${c.base}/threads/${enc(t.elementId)}/resolve`, { method: 'POST' }).then(ok);
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
      if (isOpenHere(t)) {
        openAction!.markDone(t.elementId, t.actionId ?? t.elementId);
        return;
      }
      const c = caller(t);
      if (!c || !actionRoutes(t.app)) throw new Error('inbox action: not here');
      await c
        .call(`${c.base}/tabs/${enc(t.tabId)}/actions/${enc(t.actionId ?? t.elementId)}/status`, {
          method: 'POST',
          body: { elementId: t.elementId, status: 'done' },
        })
        .then(ok);
    },
    accept: (t) => answerSuggestion(t, 'accept'),
    dismiss: (t) => answerSuggestion(t, 'dismiss'),
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
