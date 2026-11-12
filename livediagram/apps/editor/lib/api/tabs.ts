// Per-tab calls: lazy load, upsert (the autosave path), the unload flush, comments, cross-document link, and delete.
// The calls live once in @liveworkspace/workbench/lib/api/tab-calls; this binds them to this editor's api core, its
// `/documents` paths, its offline store and its own ways of marking an open and holding a grant.
import {
  CHANGESET_SEEN_HEADER,
  DOCUMENT_OPEN_HEADER,
  type TabSummary,
} from '@livediagram/api-schema';
import { normalizeTable, type CommentMention, type Tab } from '@livediagram/document';
import {
  createTabCalls,
  createUnloadHeaders,
  type AddedComment,
} from '@liveworkspace/workbench/lib/api/tab-calls';
import {
  isOfflineId,
  isOfflineIdSync,
  offlineDeleteTab,
  offlineLoadTab,
  offlineSaveDocumentMeta,
  offlineSaveTab,
} from '../offline/offline-store';
import { offlineRecordOpen } from '../offline/offline-opens';
import { ITEM_GRANT_HEADER } from '@liveworkspace/index-client/browser';
import { heldDocumentGrant } from './document-grants';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  getLastKnownToken,
  getSessionSharePassword,
  identityHeaders,
  tabForWire,
  apiFetch,
  saveTimeoutSignal,
} from './core';

// The unload flush's requests go at once, with the grant they hold (apiFetch `documentGrant: false`).
const NO_GRANT_WAIT = { documentGrant: false } as const;

/** The headers an unload request about one document carries, built synchronously: identity, the share link, the held
 *  grant and the share password. Null for a signed-in owner with no cached token, whose requests would only 401. */
export const unloadHeaders = createUnloadHeaders({
  identityHeaders: (...args) => identityHeaders(...args),
  getLastKnownToken: () => getLastKnownToken(),
  heldGrant: (...args) => heldDocumentGrant(...args),
  grantHeader: ITEM_GRANT_HEADER,
  getSessionSharePassword: () => getSessionSharePassword(),
});

const calls = createTabCalls<Tab, typeof NO_GRANT_WAIT, TabSummary>({
  // Read at call time, as the calls always did: the modules import each other, so a value taken now could still be
  // unset.
  core: {
    get API_BASE() {
      return API_BASE;
    },
    apiFetch: (...args) => apiFetch(...args),
    apiHeaders: (...args) => apiHeaders(...args),
    expectOk: (res, action) => expectOk(res, action),
    expectOkOrNull: (res, action) => expectOkOrNull(res, action),
    expectOkVoid: (res, action) => expectOkVoid(res, action),
    apiDelete: (...args) => apiDelete(...args),
    tabForWire: (tab) => tabForWire(tab),
    saveTimeoutSignal: (body) => saveTimeoutSignal(body),
  },
  itemPath: 'documents',
  idKey: 'documentId',
  changesetSeenHeader: CHANGESET_SEEN_HEADER,
  offline: {
    isOfflineId: (id) => isOfflineId(id),
    isOfflineIdSync: (id) => isOfflineIdSync(id),
    loadTab: (id, tabId) => offlineLoadTab(id, tabId),
    saveTab: (id, tab, now) => offlineSaveTab(id, tab, now),
    deleteTab: (id, tabId, now) => offlineDeleteTab(id, tabId, now),
    saveMeta: (id, patch, now) => offlineSaveDocumentMeta(id, patch, now),
    recordOpen: (id, now) => offlineRecordOpen(id, now),
  },
  openHeader: DOCUMENT_OPEN_HEADER,
  // Tables to rectangular grids: a legacy or hand-edited row with a ragged `cells` array can't reach the renderer.
  normalizeElement: (el) => (el.type === 'table' ? normalizeTable(el) : el),
  unloadHeaders,
  noGrantWait: NO_GRANT_WAIT,
});

// The full tab and its revision (docs/specs/024-agents/agent-changesets.md "The tab revision"), lazily when the user
// opens a tab; `open` declares the read an open of the document (docs/specs/013-workspace/explorer-home.md "Opens").
export const apiLoadTabRevisioned: (
  ownerId: string,
  documentId: string,
  tabId: string,
  shareCode: string | null,
  opts?: { open?: boolean },
) => Promise<{ tab: Tab; rev: number } | null> = calls.loadTabRevisioned;

// The tab alone, for callers that need no revision (a duplicate, Take Offline, the Drive mirror).
export const apiLoadTab = calls.loadTab;

// Upsert a single tab: the active edit path (docs/specs/006-document/per-tab-storage.md).
export const apiSaveTab: (
  ownerId: string,
  documentId: string,
  tab: Tab,
  shareCode?: string | null,
  opts?: {
    allowEmpty?: boolean;
    roomCursor?: { epoch: string; seq: number } | null;
    changesetSeen?: number;
  },
) => Promise<number | null> = calls.saveTab;

// The last-ditch `beforeunload` flush of pending tab and meta writes, synchronous and keepalive.
export function flushDocumentSavesBeacon(args: {
  ownerId: string;
  documentId: string;
  shareCode: string | null;
  changedTabs: Tab[];
  deletedIds: string[];
  // Tabs whose content is authoritative in memory: only these may authorise an empty-body overwrite.
  loadedTabIds: Set<string>;
  orderChanged: boolean;
  nameChanged: boolean;
  name: string;
  tabs: Tab[];
  // The seen changeset revision per tab, as the debounced save sends it.
  changesetSeen?: ReadonlyMap<string, number>;
}): void {
  calls.flushSavesBeacon({ ...args, itemId: args.documentId });
}

// Append a comment to one element's thread on a tab: the view-role visitor's write path. Answers the new comment.
export const apiAddComment: (
  ownerId: string,
  documentId: string,
  tabId: string,
  elementId: string,
  text: string,
  shareCode?: string | null,
  // Teammates the comment @-tags (docs/specs/012-collaboration/comment-mentions.md); cleaned server-side.
  mentions?: CommentMention[],
) => Promise<AddedComment> = calls.addComment;

// Delete a comment you authored (the server checks the comment's stamped author).
export const apiDeleteComment = calls.deleteComment;

// Resolve or reopen a thread through the comment endpoints (docs/specs/024-agents/agent-presence.md "Comments").
export const apiSetThreadResolved = calls.setThreadResolved;

// Share a tab of `fromDocumentId` into another of the caller's documents (docs/specs/006-document/tab-document-many-to-many.md).
// After this returns both documents hold the tab, and an edit in either reaches the other. Answers the tab as the
// target document now holds it, so the caller can show it without a full document refetch.
export const apiLinkTab: (
  ownerId: string,
  documentId: string,
  tabId: string,
  fromDocumentId: string,
) => Promise<TabSummary> = calls.linkTab;

export const apiDeleteTab = calls.deleteTab;
