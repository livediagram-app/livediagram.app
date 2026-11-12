// The index as an app's server calls it with its INDEX_KEY (liveworkspace/docs/specs/004-index/one-explorer-contracts.md):
// what an item's api Worker or Durable Object pushes about it. Split out of client.ts, which re-exports it.

import {
  INDEX_API_PATH,
  INDEX_APP_HEADER,
  type App,
  type CommunityStateAnswer,
  type CommunityStateAsk,
} from './constants';
import type {
  CollabFormInput,
  CollabFormPlace,
  CollabFormSeen,
  CollabPush,
  ItemSummary,
  AppEvent,
} from './types';
import type { AutomationSend, AutomationSendResult, CardMove } from './webhooks';
import { appConnectionPath } from './connections';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';
import { enc, IndexError, refusal } from './index-error';

export type IndexAppClientOptions = {
  app: App;
  // The app's INDEX_KEY.
  key: string;
  // The index API, when not production's (staging's, or a local one).
  baseUrl?: string | null;
  fetch?: typeof fetch;
};

// What an app's server (its api Worker or an item's Durable Object) pushes about an item.
export function createIndexAppClient({ app, key, baseUrl, fetch: doFetch }: IndexAppClientOptions) {
  const base = withoutTrailingSlashes(baseUrl || `https://www.liveworkspace.app${INDEX_API_PATH}`);
  const failed = async (res: Response): Promise<IndexError> =>
    refusal(res, await res.json().catch(() => null));
  async function put(path: string, body: unknown): Promise<void> {
    const res = await (doFetch ?? fetch)(`${base}/app${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${key}`,
        [INDEX_APP_HEADER]: app,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await failed(res);
  }
  // A body-less call to one of the index's own `/app/...` paths (`appConnectionPath`).
  async function send(method: 'PUT' | 'DELETE', path: string): Promise<void> {
    const res = await (doFetch ?? fetch)(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, [INDEX_APP_HEADER]: app },
    });
    if (!res.ok) throw await failed(res);
  }
  // A POST of one of the index's own `/app/...` paths, answering its JSON.
  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await (doFetch ?? fetch)(`${base}/app${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        [INDEX_APP_HEADER]: app,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await failed(res);
    return (await res.json()) as T;
  }
  // A read; null when the index answers 404.
  async function get<T>(path: string): Promise<T | null> {
    const res = await (doFetch ?? fetch)(`${base}/app${path}`, {
      headers: { Authorization: `Bearer ${key}`, [INDEX_APP_HEADER]: app },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw await failed(res);
    return (await res.json()) as T;
  }
  return {
    pushSummary: (itemId: string, summary: ItemSummary, updatedAt: number) =>
      put(`/items/${enc(itemId)}/summary`, { summary, updatedAt }),
    pushCollab: (itemId: string, tabId: string, push: CollabPush) =>
      put(`/items/${enc(itemId)}/collab/${enc(tabId)}`, push),
    // A form's response count for the Inbox's Form Responses, or null to take it off.
    pushForm: (itemId: string, tabId: string, form: CollabFormInput | null) =>
      put(`/items/${enc(itemId)}/forms/${enc(tabId)}`, { form }),
    // A person has seen a form's first `seen` responses.
    pushFormSeen: (itemId: string, tabId: string, seen: CollabFormSeen) =>
      put(`/items/${enc(itemId)}/forms/${enc(tabId)}/seen`, seen),
    // The item and tab a live form's public code names (one this app pushed), or null.
    formByCode: (code: string) => get<CollabFormPlace>(`/forms/${enc(code)}`),
    // How many of a form's responses a person has seen (0 when they have not opened it).
    formSeen: async (itemId: string, tabId: string, personId: string) =>
      (
        await get<{ seen: number }>(
          `/items/${enc(itemId)}/forms/${enc(tabId)}/seen/${enc(personId)}`,
        )
      )?.seen ?? 0,
    // Up to APP_EVENTS_MAX events about one item, for its History, webhooks and Most Used. Safe to send again: an
    // `edited` is one event per person and day whatever the count.
    pushEvents: (itemId: string, events: readonly AppEvent[]) =>
      put(`/items/${enc(itemId)}/events`, { events }),
    // Up to CARD_MOVES_MAX cards that changed status (liveplanner), for the item's scope's webhooks. Safe to send
    // again: each is one delivery per webhook.
    pushCardMoves: (itemId: string, moves: readonly CardMove[]) =>
      put(`/items/${enc(itemId)}/card-moves`, { moves }),
    // Up to AUTOMATION_SENDS_MAX messages a plan's automation rules post through its own webhooks (liveplanner), each
    // answered queued or refused, in the order sent. Safe to send again: a key already queued answers queued.
    pushAutomationSends: (
      itemId: string,
      sends: readonly AutomationSend[],
    ): Promise<{ results: AutomationSendResult[] }> =>
      post(`/items/${enc(itemId)}/automation-sends`, { sends }),
    // Connected tabs (connected-tabs.md): the tab holding a connection is in the host now (confirm), or has left it
    // (remove, which deletes the connection's pass). Each answers 204 whether or not it matched.
    confirmConnection: (hostId: string, connectionId: string, tabId: string) =>
      send('PUT', appConnectionPath(hostId, connectionId, tabId)),
    removeConnection: (hostId: string, connectionId: string, tabId: string) =>
      send('DELETE', appConnectionPath(hostId, connectionId, tabId)),
    // Where up to COMMUNITY_STATES_MAX Community posts' items stand (the Community's sweep), one answer per post, in
    // order. Read only.
    communityStates: async (posts: readonly CommunityStateAsk[]): Promise<CommunityStateAnswer[]> =>
      (await post<{ states: CommunityStateAnswer[] }>('/community/states', { posts })).states,
  };
}

export type IndexAppClient = ReturnType<typeof createIndexAppClient>;
