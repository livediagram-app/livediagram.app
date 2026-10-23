// The index as the Explorer and the editors call it (liveworkspace/docs/one-explorer-contracts.md): one
// typed method per call. A browser calls its own origin's `/api/index`, which its app's router forwards
// to liveworkspace.app, so there is no CORS and no liveworkspace.app cookie. A refusal throws an
// IndexError carrying the status and the `error` code, so a caller can branch on `password_required`
// and the like.

import {
  INDEX_API_PATH,
  INDEX_APP_HEADER,
  SHARE_CODE_HEADER,
  SHARE_PASSWORD_HEADER,
  type App,
  type IndexErrorCode,
} from './constants';
import type {
  CollabPush,
  CreateFolderInput,
  CreateItemInput,
  CreateShareLinkInput,
  CreateTagInput,
  Folder,
  GrantResponse,
  InboxResponse,
  Item,
  ItemListQuery,
  ItemSummary,
  Page,
  PlacementDefault,
  ShareAccess,
  ShareLink,
  ShareResolution,
  SharedWithItem,
  Tag,
  UpdateFolderInput,
  UpdateItemInput,
  UpdateShareLinkInput,
  UpdateTagInput,
} from './types';

export class IndexError extends Error {
  readonly status: number;
  readonly code: IndexErrorCode | string;
  constructor(status: number, code: string) {
    super(`index: ${status} ${code}`);
    this.name = 'IndexError';
    this.status = status;
    this.code = code;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

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

export type IndexClientOptions = {
  // The index API, e.g. `/api/index` on the app's own origin (the default), or a full URL.
  baseUrl?: string;
  // The person's access or guest token, or null for a link visitor with no identity.
  getToken: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;
};

type CallOptions = { method?: string; body?: unknown; query?: Query; share?: ShareAccess | null };

export function createIndexClient({
  baseUrl = INDEX_API_PATH,
  getToken,
  fetch: doFetch,
}: IndexClientOptions) {
  const base = baseUrl.replace(/\/+$/, '');

  async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
    const headers = new Headers();
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.share) {
      headers.set(SHARE_CODE_HEADER, options.share.code);
      if (options.share.password) headers.set(SHARE_PASSWORD_HEADER, options.share.password);
    }
    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }
    // Looked up per call so a test or a polyfill installed later is used.
    const res = await (doFetch ?? fetch)(`${base}${path}${queryString(options.query)}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });
    if (res.status === 204) return undefined as T;
    const parsed = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (!res.ok) {
      const code = typeof parsed?.error === 'string' ? parsed.error : 'unknown';
      throw new IndexError(res.status, code);
    }
    return parsed as T;
  }

  return {
    // Items
    listItems: (query: ItemListQuery = {}) =>
      call<Page<Item, 'items'>>('/items', { query: query as Query }),
    createItem: (input: CreateItemInput) =>
      call<{ item: Item; grant: GrantResponse }>('/items', { method: 'POST', body: input }),
    getItem: (id: string, share?: ShareAccess | null) =>
      call<{ item: Item }>(`/items/${enc(id)}`, { share }),
    updateItem: (id: string, input: UpdateItemInput) =>
      call<{ item: Item }>(`/items/${enc(id)}`, { method: 'PATCH', body: input }),
    // To the Trash, or with `permanent` gone for good.
    deleteItem: (id: string, options: { permanent?: boolean; reason?: 'deleted' | 'empty' } = {}) =>
      call<void>(`/items/${enc(id)}`, {
        method: 'DELETE',
        query: { permanent: options.permanent ? 'true' : undefined, reason: options.reason },
      }),
    restoreItem: (id: string) =>
      call<{ item: Item }>(`/items/${enc(id)}/restore`, { method: 'POST' }),
    copyItem: (id: string, input: { title?: string } = {}, share?: ShareAccess | null) =>
      call<{ item: Item }>(`/items/${enc(id)}/copy`, { method: 'POST', body: input, share }),
    recordOpen: (id: string, share?: ShareAccess | null) =>
      call<void>(`/items/${enc(id)}/open`, { method: 'POST', share }),
    grant: (id: string, share?: ShareAccess | null) =>
      call<GrantResponse>(`/items/${enc(id)}/grant`, { method: 'POST', share }),

    // Trash
    listTrash: (query: { app?: App; team?: string; limit?: number; cursor?: string } = {}) =>
      call<Page<Item, 'items'>>('/trash', { query }),
    emptyTrash: (query: { team?: string } = {}) =>
      call<{ purged: number }>('/trash', { method: 'DELETE', query }),

    // Folders
    listFolders: (query: { team?: string } = {}) =>
      call<{ folders: Folder[] }>('/folders', { query }),
    createFolder: (input: CreateFolderInput) =>
      call<{ folder: Folder }>('/folders', { method: 'POST', body: input }),
    updateFolder: (id: string, input: UpdateFolderInput) =>
      call<{ folder: Folder }>(`/folders/${enc(id)}`, { method: 'PATCH', body: input }),
    deleteFolder: (id: string) => call<void>(`/folders/${enc(id)}`, { method: 'DELETE' }),

    // Tags
    listTags: () => call<{ tags: Tag[] }>('/tags'),
    createTag: (input: CreateTagInput) =>
      call<{ tag: Tag }>('/tags', { method: 'POST', body: input }),
    updateTag: (id: string, input: UpdateTagInput) =>
      call<{ tag: Tag }>(`/tags/${enc(id)}`, { method: 'PATCH', body: input }),
    deleteTag: (id: string) => call<void>(`/tags/${enc(id)}`, { method: 'DELETE' }),
    tagItem: (tagId: string, itemId: string) =>
      call<void>(`/tags/${enc(tagId)}/items/${enc(itemId)}`, { method: 'PUT' }),
    untagItem: (tagId: string, itemId: string) =>
      call<void>(`/tags/${enc(tagId)}/items/${enc(itemId)}`, { method: 'DELETE' }),

    // Favourites
    listFavourites: (query: { limit?: number; cursor?: string } = {}) =>
      call<Page<{ itemId: string; createdAt: number }, 'favourites'>>('/favourites', { query }),
    favourite: (itemId: string) => call<void>(`/favourites/${enc(itemId)}`, { method: 'PUT' }),
    unfavourite: (itemId: string) => call<void>(`/favourites/${enc(itemId)}`, { method: 'DELETE' }),

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
    listShared: (query: { app?: App; limit?: number; cursor?: string } = {}) =>
      call<Page<SharedWithItem, 'shared'>>('/shared', { query }),
    removeShared: (itemId: string) => call<void>(`/shared/${enc(itemId)}`, { method: 'DELETE' }),

    // Inbox
    inbox: (query: { app?: App; limit?: number } = {}) => call<InboxResponse>('/inbox', { query }),
  };
}

export type IndexClient = ReturnType<typeof createIndexClient>;

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
  const base = (baseUrl || `https://liveworkspace.app${INDEX_API_PATH}`).replace(/\/+$/, '');
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
    if (!res.ok) {
      const parsed = (await res.json().catch(() => null)) as { error?: unknown } | null;
      throw new IndexError(
        res.status,
        typeof parsed?.error === 'string' ? parsed.error : 'unknown',
      );
    }
  }
  return {
    pushSummary: (itemId: string, summary: ItemSummary, updatedAt: number) =>
      put(`/items/${enc(itemId)}/summary`, { summary, updatedAt }),
    pushCollab: (itemId: string, tabId: string, push: CollabPush) =>
      put(`/items/${enc(itemId)}/collab/${enc(tabId)}`, push),
  };
}

export type IndexAppClient = ReturnType<typeof createIndexAppClient>;
