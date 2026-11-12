// Per-tab calls: lazy load, upsert (the autosave path), the unload flush, comments, cross-design link, and delete.
// The calls live once in @liveworkspace/workbench/lib/api/tab-calls; this binds them to this editor's api core, its
// `/designs` paths, its offline store and its own ways of marking an open and holding a grant.
import {
  CHANGESET_SEEN_HEADER,
  TAB_SAVE_CHANGES_HEADER,
  INDEX_GRANT_HEADER,
  type TabSummary,
} from '@livedesign/api-schema';
import { normalizeTable, type CommentMention, type Tab } from '@livedesign/design';
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
  offlineSaveDesignMeta,
  offlineSaveTab,
} from '../offline/offline-store';
import { offlineRecordOpen } from '../offline/offline-opens';
import { heldDesignGrant } from './design-grants';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
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

// The unload flush's requests go at once, with the grant they hold (apiFetch `designGrant: false`).
const NO_GRANT_WAIT = { designGrant: false } as const;

/** The headers an unload request about one design carries, built synchronously: identity, the share link, the held
 *  grant and the share password. Null for a signed-in owner with no cached token, whose requests would only 401. */
export const unloadHeaders = createUnloadHeaders({
  identityHeaders: (...args) => identityHeaders(...args),
  getLastKnownToken: () => getLastKnownToken(),
  heldGrant: (...args) => heldDesignGrant(...args),
  grantHeader: INDEX_GRANT_HEADER,
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
  itemPath: 'designs',
  idKey: 'designId',
  changesetSeenHeader: CHANGESET_SEEN_HEADER,
  offline: {
    isOfflineId: (id) => isOfflineId(id),
    isOfflineIdSync: (id) => isOfflineIdSync(id),
    loadTab: (id, tabId) => offlineLoadTab(id, tabId),
    saveTab: (id, tab, now) => offlineSaveTab(id, tab, now),
    deleteTab: (id, tabId, now) => offlineDeleteTab(id, tabId, now),
    saveMeta: (id, patch, now) => offlineSaveDesignMeta(id, patch, now),
    recordOpen: (id, now) => offlineRecordOpen(id, now),
  },
  // An open of the design is the index's to record, beside the tab read.
  onOpen: (id, shareCode) => {
    const share = shareCode ? { code: shareCode, password: getSessionSharePassword() } : null;
    void indexClient.recordOpen(id, share).catch((err: unknown) => {
      console.warn('[index] open not recorded', err);
    });
  },
  // Tables to rectangular grids: a legacy or hand-edited row with a ragged `cells` array can't reach the renderer.
  normalizeElement: (el) => (el.type === 'table' ? normalizeTable(el) : el),
  saveChangesHeader: TAB_SAVE_CHANGES_HEADER,
  unloadHeaders,
  noGrantWait: NO_GRANT_WAIT,
});

// The full tab and its revision (docs/specs/024-agents/agent-changesets.md "The tab revision"), lazily when the user
// opens a tab; `open` declares the read an open of the design (docs/specs/013-workspace/explorer-home.md "Opens").
export const apiLoadTabRevisioned: (
  ownerId: string,
  designId: string,
  tabId: string,
  shareCode: string | null,
  opts?: { open?: boolean },
) => Promise<{ tab: Tab; rev: number } | null> = calls.loadTabRevisioned;

// The tab alone, for callers that need no revision (a duplicate, Take Offline, the Drive mirror).
export const apiLoadTab = calls.loadTab;

// Upsert a single tab: the active edit path (docs/specs/006-design/per-tab-storage.md).
export const apiSaveTab: (
  ownerId: string,
  designId: string,
  tab: Tab,
  shareCode?: string | null,
  opts?: {
    allowEmpty?: boolean;
    roomCursor?: { epoch: string; seq: number } | null;
    changesetSeen?: number;
    saveChanges?: string | null;
  },
) => Promise<number | null> = calls.saveTab;

// The last-ditch `beforeunload` flush of pending tab and meta writes, synchronous and keepalive.
export function flushDesignSavesBeacon(args: {
  ownerId: string;
  designId: string;
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
  saveChanges?: ReadonlyMap<string, string>;
}): void {
  calls.flushSavesBeacon({ ...args, itemId: args.designId });
}

// Append a comment to one element's thread on a tab: the view-role visitor's write path. Answers the new comment.
export const apiAddComment: (
  ownerId: string,
  designId: string,
  tabId: string,
  elementId: string,
  text: string,
  shareCode?: string | null,
  // Teammates the comment @-tags (docs/specs/012-collaboration/comment-mentions.md); cleaned server-side.
  mentions?: CommentMention[],
  cell?: string,
) => Promise<AddedComment> = calls.addComment;

// Delete a comment you authored (the server checks the comment's stamped author).
export const apiDeleteComment = calls.deleteComment;

// Resolve or reopen a thread through the comment endpoints (docs/specs/024-agents/agent-presence.md "Comments").
export const apiSetThreadResolved = calls.setThreadResolved;

// Share a tab of `fromDesignId` into another of the caller's designs (docs/specs/006-design/tab-design-many-to-many.md).
// After this returns both designs hold the tab, and an edit in either reaches the other. Answers the tab as the
// target design now holds it, so the caller can show it without a full design refetch.
export const apiLinkTab: (
  ownerId: string,
  designId: string,
  tabId: string,
  fromDesignId: string,
) => Promise<TabSummary> = calls.linkTab;

export const apiDeleteTab = calls.deleteTab;
