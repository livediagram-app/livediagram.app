// Per-tab calls: lazy load, upsert (the autosave path), the unload flush, comments, cross-document link, and delete.
// The calls live once in @liveworkspace/workbench/lib/api/tab-calls; this binds them to this editor's api core, its
// `/documents` paths, its offline store and its own ways of marking an open and holding a grant.
import {
  CHANGESET_SEEN_HEADER,
  TAB_SAVE_CHANGES_HEADER,
  type TabSummary,
} from '@livedocuments/api-schema';
import {
  diffToElementOps,
  normalizeTable,
  type CommentMention,
  type Tab,
} from '@livedocuments/document';
import { createTabDraftStore } from '@liveworkspace/workbench/lib/api/tab-draft-store';
import { createTabCalls, type AddedComment } from '@liveworkspace/workbench/lib/api/tab-calls';
import {
  isOfflineId,
  isOfflineIdSync,
  offlineDeleteTab,
  offlineLoadTab,
  offlineSaveDocumentMeta,
  offlineSaveTab,
} from '../offline/offline-store';
import { offlineRecordOpen } from '../offline/offline-opens';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  getSessionSharePassword,
  tabForWire,
  apiFetch,
  saveTimeoutSignal,
} from './core';
import { NO_GRANT_WAIT, bodyBytes, takeKeepalive, unloadHeaders } from './unload-requests';

// This browser's drafts of the unload flush's tabs (docs/specs/006-document/delta-saves.md "Drafts of unsaved changes").
export const TAB_DRAFTS_DB = 'livedocuments-drafts';

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
  // An open of the document is the index's to record, beside the tab read.
  onOpen: (id, shareCode) => {
    const share = shareCode ? { code: shareCode, password: getSessionSharePassword() } : null;
    void indexClient.recordOpen(id, share).catch((err: unknown) => {
      console.warn('[index] open not recorded', err);
    });
  },
  // Tables to rectangular grids: a legacy or hand-edited row with a ragged `cells` array can't reach the renderer.
  normalizeElement: (el) => (el.type === 'table' ? normalizeTable(el) : el),
  saveChangesHeader: TAB_SAVE_CHANGES_HEADER,
  unloadHeaders: (...args) => unloadHeaders(...args),
  // The page's keepalive budget, shared with the deck's unload save (unload-requests.ts).
  takeKeepalive: (body) => takeKeepalive(bodyBytes(body)),
  noGrantWait: NO_GRANT_WAIT,
  // The autosave sends the changed elements when a base copy is held (docs/specs/006-document/delta-saves.md).
  delta: { diff: diffToElementOps },
  // The unload flush keeps a draft of each tab it sends in this browser (delta-saves.md "Drafts of unsaved changes").
  drafts: createTabDraftStore(TAB_DRAFTS_DB),
});

// The full tab and its revision (docs/specs/024-agents/agent-changesets.md "The tab revision"), lazily when the user
// opens a tab; `open` declares the read an open of the document (docs/specs/013-workspace/explorer-home.md "Opens").
// Every editor load reads this browser's draft of the tab beside it (docs/specs/006-document/delta-saves.md "Drafts
// of unsaved changes"): one put back waits in apiTakeDraftReplay, one dropped is told to onTabDraft.
export const apiLoadTabRevisioned = (
  ownerId: string,
  documentId: string,
  tabId: string,
  shareCode: string | null,
  opts: { open?: boolean } = {},
): Promise<{ tab: Tab; rev: number } | null> =>
  calls.loadTabRevisioned(ownerId, documentId, tabId, shareCode, { ...opts, draft: true });

// A draft a load put back, once, for the editor to put on screen as an unsaved edit; and every draft put back or
// dropped (useTabDrafts).
export const apiTakeDraftReplay = calls.takeDraftReplay;
export const apiDiscardDraft = calls.discardDraft;
export const onTabDraft = calls.onDraft;

// A peer's save moves the base copy (docs/specs/006-document/delta-saves.md): the digest a save of a tab that wrote a
// revision announces to the room (`tab-saved`), and a peer's announcement taken over the tab as the baseline holds it.
export const apiSavedTabDigest = calls.savedDigest;
export const apiAdoptPeerSave = calls.adoptPeerSave;

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
    saveChanges?: string | null;
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
  saveChanges?: ReadonlyMap<string, string>;
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
  cell?: string,
) => Promise<AddedComment> = calls.addComment;

// Delete a comment you authored (the server checks the comment's stamped author).
export const apiDeleteComment = calls.deleteComment;

// Resolve or reopen a thread through the comment endpoints (docs/specs/024-agents/agent-presence.md "Comments").
export const apiSetThreadResolved = calls.setThreadResolved;

// Add or take back the caller's reaction on a comment (docs/specs/012-collaboration/comment-reactions.md): the
// path a Participant's reaction takes, since the room relays element deltas from an Editor only. The server records
// it under the caller's collab key, derived from who they are; the `key` sent beside it is no longer read.
export async function apiReactToComment(
  ownerId: string,
  documentId: string,
  tabId: string,
  commentId: string,
  reaction: { emoji: string; on: boolean; key: string },
  shareCode: string | null = null,
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/comments/${encodeURIComponent(commentId)}/react`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
      body: JSON.stringify(reaction),
    },
  );
  await expectOkVoid(res, 'react to comment');
}

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
