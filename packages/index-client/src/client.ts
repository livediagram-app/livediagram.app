// The index as the Explorer and the editors call it (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): one
// typed method per call. A browser calls its own origin's `/api/index`, which its app's router forwards
// to liveworkspace.app, so there is no CORS and no liveworkspace.app cookie. A refusal throws an
// IndexError carrying the status and the `error` code, so a caller can branch on `password_required`
// and the like.

import {
  DELEGATED_TEAMS_MAX,
  INDEX_API_PATH,
  INDEX_APP_HEADER,
  INDEX_PERSON_HEADER,
  INDEX_TEAMS_HEADER,
  ITEM_GRANT_HEADER,
  SHARE_CODE_HEADER,
  SHARE_PASSWORD_HEADER,
  TEAM_AUDIT_NEXT_CURSOR_HEADER,
  type App,
  type CommunityStateAnswer,
  type CommunityStateAsk,
  type IndexErrorCode,
} from './constants';
import type {
  CollabFormInput,
  CollabFormPlace,
  CollabFormSeen,
  CollabPush,
  CreateFolderInput,
  CreateItemInput,
  CreateShareLinkInput,
  Folder,
  FolderPreview,
  SpacePreview,
  GrantResponse,
  InboxResponse,
  Item,
  ItemListQuery,
  MineCount,
  SharedListQuery,
  ItemSummary,
  Page,
  PlacementDefault,
  ShareAccess,
  ShareLink,
  ShareResolution,
  ItemRead,
  SharedWithItem,
  TeamAuditCsv,
  TeamAuditPage,
  TeamAuditQuery,
  HistoryPage,
  HistoryQuery,
  AppEvent,
  UpdateFolderInput,
  UpdateItemInput,
  UpdateShareLinkInput,
} from './types';
import type {
  AutomationSend,
  AutomationSendResult,
  CardMove,
  CreateWebhookInput,
  UpdateWebhookInput,
  Webhook,
  WebhookDelivery,
} from './webhooks';
import {
  appConnectionPath,
  type ConnectionInput,
  type ConnectionMade,
  type ConnectionOpen,
} from './connections';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';

export class IndexError extends Error {
  readonly status: number;
  readonly code: IndexErrorCode | string;
  // How long the answer's `Retry-After` asked the caller to wait (ms), or null when it sent none that parses. Raw:
  // the outbox caps it (@liveworkspace/index-app outbox.ts `failureDelayMs`).
  readonly retryAfterMs: number | null;
  constructor(status: number, code: string, retryAfterMs: number | null = null) {
    super(`index: ${status} ${code}`);
    this.name = 'IndexError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

// The longest `Retry-After` text read: ten digits of seconds is three centuries, and an HTTP date is 29 characters.
const RETRY_AFTER_TEXT_MAX = 40;

// A `Retry-After` header as a wait in ms from `now`: delta-seconds (digits only) or an HTTP date, which ends in
// `GMT` (one in the past waits 0). Null when absent, too long, or neither. Read character by character, never with a
// repeating regex.
export function retryAfterMsOf(header: string | null | undefined, now = Date.now()): number | null {
  const text = header?.trim() ?? '';
  if (text === '' || text.length > RETRY_AFTER_TEXT_MAX) return null;
  let digits = true;
  for (let i = 0; i < text.length && digits; i++) {
    const c = text.charCodeAt(i);
    digits = c >= 48 && c <= 57;
  }
  if (digits) return Number(text) * 1000;
  if (!text.endsWith('GMT')) return null;
  const at = Date.parse(text);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

type Query = Record<string, string | number | boolean | null | undefined>;

// A refusal's `{ error }` as an IndexError; `unknown` when the body names none. `res` gives its Retry-After.
function refusal(res: Response, parsed: unknown): IndexError {
  const error = (parsed as { error?: unknown } | null)?.error;
  return new IndexError(
    res.status,
    typeof error === 'string' ? error : 'unknown',
    // A stand-in response without headers (a test's, a polyfill's) has no Retry-After.
    retryAfterMsOf(res.headers?.get('Retry-After')),
  );
}

// `?a=1&b=2` from the set values, or '' when none is set.
export function queryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

const enc = encodeURIComponent;

// A list's query on the wire: a filter's values as one comma list, `deep` as 1.
function listQuery(query: ItemListQuery | SharedListQuery): Query {
  const out: Query = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) out[key] = value.length > 0 ? value.join(',') : undefined;
    else if (key === 'deep' || key === 'any') out[key] = value ? 1 : undefined;
    else out[key] = value as Query[string];
  }
  return out;
}

export type IndexClientOptions = {
  // The index API, e.g. `/api/index` on the app's own origin (the default), or a full URL.
  baseUrl?: string;
  // The person's access or guest token, or null for a link visitor with no identity.
  getToken: () => string | null | Promise<string | null>;
  // Sent on every call besides the token: an app's server acting for a person (createIndexDelegateClient).
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

type CallOptions = {
  method?: string;
  body?: unknown;
  query?: Query;
  share?: ShareAccess | null;
  signal?: AbortSignal;
  // A grant the index signed for an item (X-Index-Grant): the connected tabs' doors take the host's.
  grant?: string;
};

// What a read can take besides its query: a signal, so a list superseded by a newer one (the Explorer's
// search as the person types) is cancelled rather than left to land late.
export type RequestOptions = { signal?: AbortSignal };

export function createIndexClient({
  baseUrl = INDEX_API_PATH,
  getToken,
  headers: fixedHeaders,
  fetch: doFetch,
}: IndexClientOptions) {
  const base = withoutTrailingSlashes(baseUrl);

  async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
    const res = await send(path, options);
    if (res.status === 204) return undefined as T;
    const parsed = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (!res.ok) throw refusal(res, parsed);
    return parsed as T;
  }

  // A read answered as text (a CSV file), with its response for the headers.
  async function callText(
    path: string,
    options: CallOptions = {},
  ): Promise<{ text: string; res: Response }> {
    const res = await send(path, options);
    if (!res.ok) throw refusal(res, await res.json().catch(() => null));
    return { text: await res.text(), res };
  }

  async function send(path: string, options: CallOptions): Promise<Response> {
    const headers = new Headers(fixedHeaders);
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.share) {
      headers.set(SHARE_CODE_HEADER, options.share.code);
      if (options.share.password) headers.set(SHARE_PASSWORD_HEADER, options.share.password);
    }
    if (options.grant) headers.set(ITEM_GRANT_HEADER, options.grant);
    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }
    // Looked up per call so a test or a polyfill installed later is used.
    return (doFetch ?? fetch)(`${base}${path}${queryString(options.query)}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  }

  return {
    // Items
    listItems: (query: ItemListQuery = {}, options: RequestOptions = {}) =>
      call<
        Page<Item, 'items'> & {
          mostUsed?: Item[];
          mine?: MineCount;
          any?: boolean;
          newest?: Item[];
        }
      >('/items', {
        query: listQuery(query),
        signal: options.signal,
      }),
    createItem: (input: CreateItemInput) =>
      call<{ item: Item; grant: GrantResponse }>('/items', { method: 'POST', body: input }),
    getItem: (id: string, share?: ShareAccess | null) =>
      call<ItemRead>(`/items/${enc(id)}`, { share }),
    // Up to ITEM_LOOKUP_IDS_MAX items in one request, each as getItem would answer it without a share password, in
    // the order asked; those it would refuse are left out.
    lookupItems: (ids: readonly string[]) =>
      call<{ items: Item[] }>('/items/lookup', { method: 'POST', body: { ids } }),
    updateItem: (id: string, input: UpdateItemInput) =>
      call<{ item: Item }>(`/items/${enc(id)}`, { method: 'PATCH', body: input }),
    // To the Trash, or with `permanent` gone for good.
    // `reason: 'offline'` (with `permanent`): taken offline into one browser.
    deleteItem: (
      id: string,
      options: { permanent?: boolean; reason?: 'deleted' | 'empty' | 'offline' } = {},
    ) =>
      call<void>(`/items/${enc(id)}`, {
        method: 'DELETE',
        query: { permanent: options.permanent ? 'true' : undefined, reason: options.reason },
      }),
    restoreItem: (id: string) =>
      call<{ item: Item }>(`/items/${enc(id)}/restore`, { method: 'POST' }),
    // To its owner's Archived; `updateItem` naming a folder or a team moves it out.
    archiveItem: (id: string) =>
      call<{ item: Item }>(`/items/${enc(id)}/archive`, { method: 'POST' }),
    copyItem: (id: string, input: { title?: string } = {}, share?: ShareAccess | null) =>
      call<{ item: Item }>(`/items/${enc(id)}/copy`, { method: 'POST', body: input, share }),
    recordOpen: (id: string, share?: ShareAccess | null) =>
      call<void>(`/items/${enc(id)}/open`, { method: 'POST', share }),
    grant: (id: string, share?: ShareAccess | null) =>
      call<GrantResponse>(`/items/${enc(id)}/grant`, { method: 'POST', share }),

    // Trash
    listTrash: (
      query: { app?: App; team?: string; limit?: number; cursor?: string } = {},
      options: RequestOptions = {},
    ) => call<Page<Item, 'items'>>('/trash', { query, signal: options.signal }),
    // `app` empties that app's items only; without it, every app's.
    emptyTrash: (query: { team?: string; app?: App } = {}) =>
      call<{ purged: number }>('/trash', { method: 'DELETE', query }),

    // Folders
    // Paged like every list (≤ 200 a page, oldest first); without `team`, every scope the person has.
    listFolders: (
      query: { team?: string; limit?: number; cursor?: string } = {},
      options: RequestOptions = {},
    ) => call<Page<Folder, 'folders'>>('/folders', { query, signal: options.signal }),
    // What each folder card shows of its insides: up to FOLDER_PREVIEW_IDS_MAX folders in one request; folders the
    // person cannot reach are left out.
    folderPreviews: (
      ids: readonly string[],
      query: { app?: App } = {},
      options: RequestOptions = {},
    ) =>
      call<{ previews: FolderPreview[] }>('/folders/previews', {
        query: { ids: ids.join(','), app: query.app },
        signal: options.signal,
      }),
    // What Home's Spaces tiles show: the person's own space, then each team they are in, in one request.
    spacePreviews: (query: { app?: App } = {}, options: RequestOptions = {}) =>
      call<{ spaces: SpacePreview[] }>('/spaces/previews', {
        query: { app: query.app },
        signal: options.signal,
      }),
    createFolder: (input: CreateFolderInput) =>
      call<{ folder: Folder }>('/folders', { method: 'POST', body: input }),
    updateFolder: (id: string, input: UpdateFolderInput) =>
      call<{ folder: Folder }>(`/folders/${enc(id)}`, { method: 'PATCH', body: input }),
    deleteFolder: (id: string) => call<void>(`/folders/${enc(id)}`, { method: 'DELETE' }),

    // Favourites
    listFavourites: (query: { limit?: number; cursor?: string } = {}) =>
      call<Page<{ itemId: string; createdAt: number }, 'favourites'>>('/favourites', { query }),
    favourite: (itemId: string) => call<void>(`/favourites/${enc(itemId)}`, { method: 'PUT' }),
    unfavourite: (itemId: string) => call<void>(`/favourites/${enc(itemId)}`, { method: 'DELETE' }),

    // Hide from Recent / Show in Recent: the person's own Recent and Home's Most Used only.
    hideFromRecent: (itemId: string) =>
      call<void>(`/recent-hidden/${enc(itemId)}`, { method: 'PUT' }),
    showInRecent: (itemId: string) =>
      call<void>(`/recent-hidden/${enc(itemId)}`, { method: 'DELETE' }),

    // Where New files an item
    listPlacementDefaults: () => call<{ defaults: PlacementDefault[] }>('/placement-defaults'),
    setPlacementDefault: (key: string, folderId: string) =>
      call<void>(`/placement-defaults/${enc(key)}`, { method: 'PUT', body: { folderId } }),
    clearPlacementDefault: (key: string) =>
      call<void>(`/placement-defaults/${enc(key)}`, { method: 'DELETE' }),

    // Sharing
    listShareLinks: (itemId: string) =>
      call<{ links: ShareLink[]; passwordSet: boolean }>(`/items/${enc(itemId)}/share`),
    createShareLink: (itemId: string, input: CreateShareLinkInput = {}) =>
      call<{ link: ShareLink }>(`/items/${enc(itemId)}/share`, { method: 'POST', body: input }),
    revokeAllShareLinks: (itemId: string) =>
      call<void>(`/items/${enc(itemId)}/share`, { method: 'DELETE' }),
    updateShareLink: (code: string, input: UpdateShareLinkInput) =>
      call<{ link: ShareLink }>(`/share/${enc(code)}`, { method: 'PATCH', body: input }),
    revokeShareLink: (code: string) => call<void>(`/share/${enc(code)}`, { method: 'DELETE' }),
    extendShareLink: (code: string) =>
      call<{ link: ShareLink }>(`/share/${enc(code)}/extend`, { method: 'POST' }),
    setSharePassword: (itemId: string, password: string | null) =>
      call<{ passwordSet: boolean }>(`/items/${enc(itemId)}/share-password`, {
        method: 'PUT',
        body: { password },
      }),
    // What a link opens; records it under Shared for a signed-in person or guest.
    resolveShare: (code: string, password?: string | null) =>
      call<ShareResolution>(`/share/${enc(code)}`, { share: { code, password } }),
    listShared: (query: SharedListQuery = {}, options: RequestOptions = {}) =>
      call<Page<SharedWithItem, 'shared'>>('/shared', {
        query: listQuery(query),
        signal: options.signal,
      }),
    removeShared: (itemId: string) => call<void>(`/shared/${enc(itemId)}`, { method: 'DELETE' }),

    // Connected tabs (connected-tabs.md), each with the host's grant. Make one on `hostId`'s tab; where one leads
    // (410 `connection_target_gone` or `connection_link_removed` when nowhere); take one back when the tab never
    // made it into the host.
    makeConnection: (hostId: string, input: ConnectionInput, grant: string) =>
      call<ConnectionMade>(`/items/${enc(hostId)}/connections`, {
        method: 'POST',
        body: input,
        grant,
      }),
    openConnection: (id: string, grant: string, options: RequestOptions = {}) =>
      call<ConnectionOpen>(`/connections/${enc(id)}`, { grant, signal: options.signal }),
    takeBackConnection: (id: string, grant: string) =>
      call<void>(`/connections/${enc(id)}`, { method: 'DELETE', grant }),

    // One item's History: its events of the last EVENT_RETENTION_MS, newest first, a page at a time (HISTORY_PAGE
    // by default, at most HISTORY_LIMIT_MAX). Its owner's and its team's only; anyone else is 404.
    itemHistory: (itemId: string, query: HistoryQuery = {}, options: RequestOptions = {}) =>
      call<HistoryPage>(`/items/${enc(itemId)}/history`, { query, signal: options.signal }),

    // Webhooks (webhooks.md): one document's, for someone who can edit all of it. `share`: the link the person
    // reaches it through, when it is not one they opened before (the index also finds those under Shared).
    listWebhooks: (itemId: string, share?: ShareAccess | null) =>
      call<{ webhooks: Webhook[] }>(`/items/${enc(itemId)}/webhooks`, { share }),
    // `secret` only for a `json` webhook, and only now.
    createWebhook: (itemId: string, input: CreateWebhookInput, share?: ShareAccess | null) =>
      call<{ webhook: Webhook; secret: string | null }>(`/items/${enc(itemId)}/webhooks`, {
        method: 'POST',
        body: input,
        share,
      }),
    updateWebhook: (id: string, input: UpdateWebhookInput, share?: ShareAccess | null) =>
      call<{ webhook: Webhook }>(`/webhooks/${enc(id)}`, { method: 'PATCH', body: input, share }),
    deleteWebhook: (id: string, share?: ShareAccess | null) =>
      call<void>(`/webhooks/${enc(id)}`, { method: 'DELETE', share }),
    testWebhook: (id: string, share?: ShareAccess | null) =>
      call<{ queued: true }>(`/webhooks/${enc(id)}/test`, { method: 'POST', share }),
    webhookDeliveries: (id: string, share?: ShareAccess | null) =>
      call<{ deliveries: WebhookDelivery[] }>(`/webhooks/${enc(id)}/deliveries`, { share }),

    // The team audit log (team-audit-log.md "Who reads it"): a team admin's alone, newest first, a page at a time,
    // or as a CSV file of up to TEAM_AUDIT_CSV_MAX rows.
    teamAudit: (query: TeamAuditQuery, options: RequestOptions = {}) =>
      call<TeamAuditPage>('/team-audit', { query, signal: options.signal }),
    teamAuditCsv: async (query: Omit<TeamAuditQuery, 'limit'>): Promise<TeamAuditCsv> => {
      const { text, res } = await callText('/team-audit', { query: { ...query, format: 'csv' } });
      return { csv: text, nextCursor: res.headers.get(TEAM_AUDIT_NEXT_CURSOR_HEADER) };
    },

    // Inbox
    inbox: (query: { app?: App; limit?: number } = {}, options: RequestOptions = {}) =>
      call<InboxResponse>('/inbox', { query, signal: options.signal }),
  };
}

export type IndexClient = ReturnType<typeof createIndexClient>;

export type IndexDelegateOptions = {
  app: App;
  // The app's INDEX_KEY.
  key: string;
  // The account the app acts for, which the app has already checked (an API token's account, say).
  personId: string;
  // The teams that account has joined, as the app knows them (its token's answer).
  teams?: readonly string[];
  // The index API, when not production's.
  baseUrl?: string | null;
  fetch?: typeof fetch;
};

// The index as an app's server calls it for an account it has checked itself, when the account's own access
// token is not in hand (an API token from the CLI or an AI tool). The index treats the call as that account's,
// but only for this app's items: it lists only them, makes only them, and answers any other as missing
// (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Reaching the index").
export function createIndexDelegateClient({
  app,
  key,
  personId,
  teams = [],
  baseUrl,
  fetch: doFetch,
}: IndexDelegateOptions): IndexClient {
  return createIndexClient({
    baseUrl: withoutTrailingSlashes(baseUrl || `https://www.liveworkspace.app${INDEX_API_PATH}`),
    getToken: () => key,
    headers: {
      [INDEX_APP_HEADER]: app,
      [INDEX_PERSON_HEADER]: personId,
      [INDEX_TEAMS_HEADER]: teams.slice(0, DELEGATED_TEAMS_MAX).join(','),
    },
    ...(doFetch ? { fetch: doFetch } : {}),
  });
}

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
