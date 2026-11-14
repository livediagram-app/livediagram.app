// Per-tab calls: lazy load, upsert (the autosave path), the unload flush, comments, cross-plan link, and delete.
// The calls live once in @liveworkspace/workbench/lib/api/tab-calls; this binds them to this editor's api core, its
// `/projects` paths, its offline store and its own ways of marking an open and holding a grant.
import {
  CHANGESET_SEEN_HEADER,
  INDEX_GRANT_HEADER,
  type TabSummary,
} from '@liveplanner/api-schema';
import {
  diffToElementOps,
  normalizeTable,
  type CommentMention,
  type Tab,
} from '@liveplanner/project';
import { createTabDraftStore } from '@liveworkspace/workbench/lib/api/tab-draft-store';
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
  offlineSaveProjectMeta,
  offlineSaveTab,
} from '../offline/offline-store';
import { offlineRecordOpen } from '../offline/offline-opens';
import { heldPlanGrant } from './plan-grants';
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

// This browser's drafts of the unload flush's tabs (docs/specs/006-project/delta-saves.md "Drafts of unsaved changes").
export const TAB_DRAFTS_DB = 'liveplanner-drafts';

// The unload flush's requests go at once, with the grant they hold (apiFetch `planGrant: false`).
const NO_GRANT_WAIT = { planGrant: false } as const;

/** The headers an unload request about one plan carries, built synchronously: identity, the share link, the held
 *  grant and the share password. Null for a signed-in owner with no cached token, whose requests would only 401. */
const unloadHeaders = createUnloadHeaders({
  identityHeaders: (...args) => identityHeaders(...args),
  getLastKnownToken: () => getLastKnownToken(),
  heldGrant: (...args) => heldPlanGrant(...args),
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
  itemPath: 'projects',
  idKey: 'projectId',
  changesetSeenHeader: CHANGESET_SEEN_HEADER,
  offline: {
    isOfflineId: (id) => isOfflineId(id),
    isOfflineIdSync: (id) => isOfflineIdSync(id),
    loadTab: (id, tabId) => offlineLoadTab(id, tabId),
    saveTab: (id, tab, now) => offlineSaveTab(id, tab, now),
    deleteTab: (id, tabId, now) => offlineDeleteTab(id, tabId, now),
    saveMeta: (id, patch, now) => offlineSaveProjectMeta(id, patch, now),
    recordOpen: (id, now) => offlineRecordOpen(id, now),
  },
  // An open of the plan is the index's to record, beside the tab read.
  onOpen: (id, shareCode) => {
    const share = shareCode ? { code: shareCode, password: getSessionSharePassword() } : null;
    void indexClient.recordOpen(id, share).catch((err: unknown) => {
      console.warn('[index] open not recorded', err);
    });
  },
  // Tables to rectangular grids: a legacy or hand-edited row with a ragged `cells` array can't reach the renderer.
  normalizeElement: (el) => (el.type === 'table' ? normalizeTable(el) : el),
  unloadHeaders,
  noGrantWait: NO_GRANT_WAIT,
  // The autosave sends the changed elements when a base copy is held (docs/specs/006-project/delta-saves.md).
  delta: { diff: diffToElementOps },
  // The unload flush keeps a draft of each tab it sends in this browser (delta-saves.md "Drafts of unsaved changes").
  drafts: createTabDraftStore(TAB_DRAFTS_DB),
});

// The full tab and its revision (docs/specs/024-agents/agent-changesets.md "The tab revision"), lazily when the user
// opens a tab; `open` declares the read an open of the plan (docs/specs/013-workspace/explorer-home.md "Opens").
// Every editor load reads this browser's draft of the tab beside it (docs/specs/006-project/delta-saves.md "Drafts
// of unsaved changes"): one put back waits in apiTakeDraftReplay, one dropped is told to onTabDraft.
export const apiLoadTabRevisioned = (
  ownerId: string,
  projectId: string,
  tabId: string,
  shareCode: string | null,
  opts: { open?: boolean } = {},
): Promise<{ tab: Tab; rev: number } | null> =>
  calls.loadTabRevisioned(ownerId, projectId, tabId, shareCode, { ...opts, draft: true });

// A draft a load put back, once, for the editor to put on screen as an unsaved edit; and every draft put back or
// dropped (useTabDrafts).
export const apiTakeDraftReplay = calls.takeDraftReplay;
export const apiDiscardDraft = calls.discardDraft;
export const onTabDraft = calls.onDraft;

// A peer's save moves the base copy (docs/specs/006-project/delta-saves.md): the digest a save of a tab that wrote a
// revision announces to the room (`tab-saved`), and a peer's announcement taken over the tab as the baseline holds it.
export const apiSavedTabDigest = calls.savedDigest;
export const apiAdoptPeerSave = calls.adoptPeerSave;

// The tab alone, for callers that need no revision (a duplicate, Take Offline, the Drive mirror).
export const apiLoadTab = calls.loadTab;

// Upsert a single tab: the active edit path (docs/specs/006-project/per-tab-storage.md).
export const apiSaveTab: (
  ownerId: string,
  projectId: string,
  tab: Tab,
  shareCode?: string | null,
  opts?: {
    allowEmpty?: boolean;
    roomCursor?: { epoch: string; seq: number } | null;
    changesetSeen?: number;
  },
) => Promise<number | null> = calls.saveTab;

// The last-ditch `beforeunload` flush of pending tab and meta writes, synchronous and keepalive.
export function flushProjectSavesBeacon(args: {
  ownerId: string;
  projectId: string;
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
  calls.flushSavesBeacon({ ...args, itemId: args.projectId });
}

// Append a comment to one element's thread on a tab: the view-role visitor's write path. Answers the new comment.
export const apiAddComment: (
  ownerId: string,
  projectId: string,
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

export const apiDeleteTab = calls.deleteTab;
