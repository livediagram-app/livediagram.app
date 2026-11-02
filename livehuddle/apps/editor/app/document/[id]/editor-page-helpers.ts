// Pure Tab helpers lifted out of editor-page.tsx to slim the page
// component. No React, no editor state — just shape transforms on
// Tab[] used by the document-hydration + autosave paths.
import type { Tab } from '@livehuddle/document';
import type { AccessLevel } from '@livehuddle/api-schema';

export function createTab(name: string): Tab {
  // New tabs (and a new document's first tab) default the per-tab text size
  // to small (docs/specs/004-interface-design/fonts.md); elements added from the palette inherit it via
  // `defaultTextSize`. A new tab added to an existing document still inherits
  // the active tab's explicit size where it has one (see useTabActions).
  return { id: crypto.randomUUID(), name, elements: [], defaultTextSize: 'sm' };
}

// Build the lazy-load placeholder tabs from a document's tab summaries.
// A document should always carry at least one tab; if the API ever
// returns zero summaries (a partial delete, a seeding bug, or a race
// that stripped the last tab) we materialise a fresh Tab 1 rather than
// leaving `tabs` empty. An empty tabs array makes `activeTab` (which
// falls back to `tabs[0]`) undefined, and the editor crashes on the
// first `activeTab.elements` read. The seeded tab autosaves back to the
// API on the next save cycle, healing the document.
export function placeholdersFromSummaries(
  summaries: { id: string; name: string; folder?: string }[],
): Tab[] {
  if (summaries.length === 0) return [createTab('Tab 1')];
  // Carry `folder` (docs/specs/006-document/tab-folders.md) so the tab bar renders folders from the
  // first paint; the lazy per-tab content fetch fills `elements` later
  // without touching folder (it's link metadata, not body content).
  return summaries.map((summary) => ({
    id: summary.id,
    name: summary.name,
    elements: [],
    folder: summary.folder,
  }));
}

// What the canvas should show for the ACTIVE tab while its lazy per-tab
// fetch (docs/specs/006-document/per-tab-storage.md) is outstanding. Without this gate the canvas paints
// the misleading "Empty canvas" card over a tab whose real content
// hasn't arrived yet — and worse, lets the user edit that blank
// placeholder, whose autosave then overwrites the real server row.
//
//   - 'error':   the fetch failed (network / 5xx). Block editing, offer retry.
//   - 'loading': fetch still outstanding AND nothing local to paint yet.
//   - 'ready':   content is loaded, the tab was created locally, or a peer
//                already delivered its elements — render the canvas as normal.
export type TabLoadState = 'loading' | 'error' | 'ready';

export function deriveTabLoadState(input: {
  hydrated: boolean;
  hasDocument: boolean;
  // The active tab id is in the loaded-set (its content has landed, or
  // it was created locally so there's nothing to fetch).
  loaded: boolean;
  // The active tab's lazy fetch threw (network / 5xx).
  errored: boolean;
  elementsLength: number;
  templateChosen: boolean;
}): TabLoadState {
  // Pre-hydration / no document: the document-level loader owns the screen.
  if (!input.hydrated || !input.hasDocument) return 'ready';
  if (input.errored) return 'error';
  if (input.loaded) return 'ready';
  // Not loaded yet. Only a tab with nothing local to paint should show
  // the loader — a tab that already carries elements (e.g. delivered by
  // a realtime peer) renders, rather than flashing a spinner over real
  // content. `templateChosen` covers the freshly-emptied-by-template
  // case where elements is briefly 0 but the picker has been dismissed.
  if (input.elementsLength === 0 && !input.templateChosen) return 'loading';
  return 'ready';
}

// Patch one tab in a Tab[] by id, spreading `patch` over its fields.
// Tabs whose id doesn't match are returned by reference, so callers
// that diff by-identity (notably the autosave's `prevTabById !== t`
// check) still skip the unchanged ones. Replaces every inline
// `ts.map((t) => (t.id === ... ? { ...t, ... } : t))` site whose
// patch is a static Partial<Tab>. Two sites that build their patch
// from the prior tab's elements (mapElements / [...t.elements, el])
// stay inline since the static-patch shape doesn't fit them.
export function patchTab(ts: Tab[], id: string, patch: Partial<Tab>): Tab[] {
  return ts.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

// What the autosave needs to persist this cycle, derived purely from
// the last-saved snapshot vs the current state. This is the data-
// integrity kernel of the editor's autosave: a bug here means lost
// edits (something changed but `hasChanges` stayed false) or wasted /
// wrong writes. It was duplicated verbatim in BOTH autosave paths (the
// debounced save and the beforeunload flush); centralising it here
// keeps the two in lockstep and makes the decision unit-testable
// without standing up the effect.
//
// `changedTabs` is identity-based: callers patch tabs immutably
// (see `patchTab`), so an unchanged tab keeps its reference and is
// skipped. `orderChanged` covers tab add/remove count, a pure
// reorder, AND a per-document folder change (docs/specs/006-document/tab-folders.md) — folder rides
// the same meta-save path as order, so a folder-only edit must flip
// this even when positions are unchanged. `deletedIds` are tabs
// present at last save but gone now.
//
// `loadedTabIds` (when supplied) is the data-loss guard. Tabs hydrate
// lazily (docs/specs/006-document/per-tab-storage.md): until a tab is opened its in-memory `elements` is an
// empty placeholder, NOT its real server content. A non-content op that
// only bumps a background tab's object reference — a folder move, a
// reorder, a bulk tab edit — would otherwise flag that placeholder as
// "changed" and the autosave would `PUT` it, overwriting the real row
// with `{ elements: [] }`. So a tab is eligible for a content write only
// when its content is authoritative in memory: it's in the loaded set
// (hydration's active tab, a fetched tab, or a locally-created one — see
// `markTabLoaded`) OR it already carries elements (e.g. peer-delivered).
// An unloaded, still-empty placeholder is never persisted. Callers that
// don't pass the set (older tests) keep the unguarded behaviour.
type TabSaveDiff = {
  changedTabs: Tab[];
  deletedIds: string[];
  orderChanged: boolean;
  nameChanged: boolean;
  hasChanges: boolean;
};

// Is this tab unchanged since the baseline? Identity first (the common case:
// an untouched tab keeps its object), then content. A peer's op is applied to
// the tabs on screen and to the baseline separately (docs/specs/012-collaboration/collab-race-hardening.md), so the two end
// up as different objects holding the same thing, and that is not a local
// change. A false "changed" here only costs a redundant save.
function sameTabContent(prev: Tab | undefined, current: Tab): boolean {
  if (prev === current) return true;
  if (!prev) return false;
  // Element by element, identity first: a real edit usually leaves every
  // other element the same object, so only the changed ones are serialised,
  // not the whole tab twice on every autosave.
  if (prev.elements.length !== current.elements.length) return false;
  for (let i = 0; i < current.elements.length; i++) {
    const a = prev.elements[i];
    const b = current.elements[i];
    if (a !== b && JSON.stringify(a) !== JSON.stringify(b)) return false;
  }
  // The rest of the tab key by key, identity first too: a Pages tab's articles and pages are large,
  // and serialising all of it on both sides every autosave cost the most when nothing in it had changed.
  const prevMeta = prev as unknown as Record<string, unknown>;
  const currentMeta = current as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(prevMeta), ...Object.keys(currentMeta)])) {
    if (key === 'elements') continue;
    const a = prevMeta[key];
    const b = currentMeta[key];
    if (a !== b && JSON.stringify(a) !== JSON.stringify(b)) return false;
  }
  return true;
}

// Whether the autosave may write this document (docs/specs/007-editor/load-recovery.md "Offline").
// A document that failed to load, or was not found, is never written: those error paths still hydrate
// with the id, and the editor's empty default tab would otherwise save into the real document once
// the connection is back.
export function autosaveReadOnly(state: {
  canEdit: boolean;
  loadError: boolean;
  documentNotFound: boolean;
}): boolean {
  return !state.canEdit || state.loadError || state.documentNotFound;
}

export function computeTabSaveDiff(
  prevTabs: Tab[],
  currentTabs: Tab[],
  prevName: string,
  currentName: string,
  loadedTabIds?: ReadonlySet<string>,
): TabSaveDiff {
  const prevTabById = new Map(prevTabs.map((t) => [t.id, t] as const));
  const changedTabs = currentTabs
    .filter((t) => !sameTabContent(prevTabById.get(t.id), t))
    .filter((t) => !loadedTabIds || loadedTabIds.has(t.id) || t.elements.length > 0);
  const orderChanged =
    currentTabs.length !== prevTabs.length ||
    currentTabs.some(
      (t, i) =>
        prevTabs[i]?.id !== t.id ||
        // Coalesce '' / whitespace to undefined so a loose tab never
        // looks "changed" against another loose representation.
        (prevTabs[i]?.folder?.trim() || undefined) !== (t.folder?.trim() || undefined),
    );
  const nameChanged = currentName !== prevName;
  const deletedIds = prevTabs
    .filter((t) => !currentTabs.some((current) => current.id === t.id))
    .map((t) => t.id);
  const hasChanges = changedTabs.length > 0 || orderChanged || nameChanged || deletedIds.length > 0;
  return { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges };
}

// Resolve the viewer's session against a fetched document (docs/specs/014-identity/auth-and-guest-access.md +
// docs/specs/015-api/api.md). Security-critical: it decides whether the caller is the
// owner (always 'edit', never carries a share code) or a visitor (role
// + share code come from the link they followed). The same
// `ownerId === selfId` test was inlined six times in the hydration
// path; a slip in any one (e.g. treating an owner as a visitor, or
// keeping a visitor's code on an owner request) corrupts authorisation,
// so it lives here once, under test.
//
//   - isOwner:          the document belongs to this session's id.
//   - sessionRole:      owners edit; visitors inherit the link's role.
//   A Community post's link (`community`) is a viewing surface for everyone, its author included
//   (docs/specs/025-community/community.md "Viewing a post's document"): it never opens the board as its
//   owner, so the author reads it like any visitor and edits it from their own document instead.
//   - sessionShareCode: owners send none; visitors carry the code that
//                       admitted them so write paths can authorise.
type DocumentSession = {
  isOwner: boolean;
  sessionRole: AccessLevel;
  sessionShareCode: string | null;
};

export function resolveDocumentSession(input: {
  documentOwnerId: string;
  selfId: string;
  shareRole: AccessLevel;
  shareCodeParam: string | null;
  community?: boolean;
  // The embed view (docs/specs/013-workspace/embeds.md): below Editor it only looks, having no identity screen to
  // put a name on what it adds (docs/specs/013-workspace/share-roles.md, blueprint SR6).
  embed?: boolean;
}): DocumentSession {
  if (input.community) {
    return { isOwner: false, sessionRole: 'view', sessionShareCode: input.shareCodeParam };
  }
  const isOwner = input.documentOwnerId === input.selfId;
  const linkRole = input.embed && input.shareRole !== 'edit' ? 'view' : input.shareRole;
  return {
    isOwner,
    sessionRole: isOwner ? 'edit' : linkRole,
    sessionShareCode: isOwner ? null : input.shareCodeParam,
  };
}

// May this session share the document (the header's Share button, the Share command, the share-link
// list)? Its owner, and on a TEAM document every joined member
// (docs/specs/013-workspace/team-shared-documents.md: the team's library belongs to all of them). A
// team document opened without a share code was let in by the api as owner or joined member, so no
// code plus a team id is membership; a share-link visitor carries a code and stays a visitor, who
// gets Make a Copy instead.
export function mayShareDocument(input: {
  isOwner: boolean;
  teamId: string | null;
  sessionShareCode: string | null;
}): boolean {
  return input.isOwner || (input.teamId !== null && input.sessionShareCode === null);
}

// Drop entries whose key isn't in `present`, returning the SAME map
// reference when nothing was removed. The realtime presence handler
// prunes its remote tab-focus / selection / cursor maps with this when
// a participant disconnects — a stale entry leaves a ghost cursor or
// selection ring on the canvas. Identity preservation is load-bearing:
// returning a fresh Map on every presence ping would re-render every
// presence consumer even when the roster didn't change. Was inlined
// three times (once per map); generic here so the one tested copy backs
// all three.
export function pruneMapToPresent<V>(prev: Map<string, V>, present: Set<string>): Map<string, V> {
  let changed = false;
  const next = new Map<string, V>();
  for (const [id, value] of prev) {
    if (present.has(id)) next.set(id, value);
    else changed = true;
  }
  return changed ? next : prev;
}
