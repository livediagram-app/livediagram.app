// Pure Tab helpers lifted out of editor-page.tsx to slim the page
// component. No React, no editor state — just shape transforms on
// Tab[] used by the diagram-hydration + autosave paths.
import type { Tab } from '@livediagram/diagram';

export function createTab(name: string): Tab {
  return { id: crypto.randomUUID(), name, elements: [] };
}

// Build the lazy-load placeholder tabs from a diagram's tab summaries.
// A diagram should always carry at least one tab; if the API ever
// returns zero summaries (a partial delete, a seeding bug, or a race
// that stripped the last tab) we materialise a fresh Tab 1 rather than
// leaving `tabs` empty. An empty tabs array makes `activeTab` (which
// falls back to `tabs[0]`) undefined, and the editor crashes on the
// first `activeTab.elements` read. The seeded tab autosaves back to the
// API on the next save cycle, healing the diagram.
export function placeholdersFromSummaries(summaries: { id: string; name: string }[]): Tab[] {
  if (summaries.length === 0) return [createTab('Tab 1')];
  return summaries.map((summary) => ({ id: summary.id, name: summary.name, elements: [] }));
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
// skipped. `orderChanged` covers both tab add/remove count and a pure
// reorder. `deletedIds` are tabs present at last save but gone now.
export type TabSaveDiff = {
  changedTabs: Tab[];
  deletedIds: string[];
  orderChanged: boolean;
  nameChanged: boolean;
  hasChanges: boolean;
};

export function computeTabSaveDiff(
  prevTabs: Tab[],
  currentTabs: Tab[],
  prevName: string,
  currentName: string,
): TabSaveDiff {
  const prevTabById = new Map(prevTabs.map((t) => [t.id, t] as const));
  const changedTabs = currentTabs.filter((t) => prevTabById.get(t.id) !== t);
  const orderChanged =
    currentTabs.length !== prevTabs.length || currentTabs.some((t, i) => prevTabs[i]?.id !== t.id);
  const nameChanged = currentName !== prevName;
  const deletedIds = prevTabs
    .filter((t) => !currentTabs.some((current) => current.id === t.id))
    .map((t) => t.id);
  const hasChanges = changedTabs.length > 0 || orderChanged || nameChanged || deletedIds.length > 0;
  return { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges };
}

// Resolve the viewer's session against a fetched diagram (spec/04 +
// spec/11). Security-critical: it decides whether the caller is the
// owner (always 'edit', never carries a share code) or a visitor (role
// + share code come from the link they followed). The same
// `ownerId === selfId` test was inlined six times in the hydration
// path; a slip in any one (e.g. treating an owner as a visitor, or
// keeping a visitor's code on an owner request) corrupts authorisation,
// so it lives here once, under test.
//
//   - isOwner:          the diagram belongs to this session's id.
//   - sessionRole:      owners edit; visitors inherit the link's role.
//   - sessionShareCode: owners send none; visitors carry the code that
//                       admitted them so write paths can authorise.
//   - canEditLog:       owner OR edit-role visitor may read/write the
//                       change log.
export type DiagramSession = {
  isOwner: boolean;
  sessionRole: 'edit' | 'view';
  sessionShareCode: string | null;
  canEditLog: boolean;
};

export function resolveDiagramSession(input: {
  diagramOwnerId: string;
  selfId: string;
  shareRole: 'edit' | 'view';
  shareCodeParam: string | null;
}): DiagramSession {
  const isOwner = input.diagramOwnerId === input.selfId;
  return {
    isOwner,
    sessionRole: isOwner ? 'edit' : input.shareRole,
    sessionShareCode: isOwner ? null : input.shareCodeParam,
    canEditLog: isOwner || input.shareRole === 'edit',
  };
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
