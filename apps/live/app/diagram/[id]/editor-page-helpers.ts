// Pure Tab helpers lifted out of editor-page.tsx to slim the page
// component. No React, no editor state — just shape transforms on
// Tab[] used by the diagram-hydration + autosave paths.
import {
  autoLayoutElements,
  isBoxed,
  isLayoutCandidate,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { autoAlignElements } from '@/lib/auto-align';

export function createTab(name: string): Tab {
  // New tabs (and a new diagram's first tab) default the per-tab text size
  // to small (spec/28); elements added from the palette inherit it via
  // `defaultTextSize`. A new tab added to an existing diagram still inherits
  // the active tab's explicit size where it has one (see useTabActions).
  return { id: crypto.randomUUID(), name, elements: [], defaultTextSize: 'sm' };
}

// Build the lazy-load placeholder tabs from a diagram's tab summaries.
// A diagram should always carry at least one tab; if the API ever
// returns zero summaries (a partial delete, a seeding bug, or a race
// that stripped the last tab) we materialise a fresh Tab 1 rather than
// leaving `tabs` empty. An empty tabs array makes `activeTab` (which
// falls back to `tabs[0]`) undefined, and the editor crashes on the
// first `activeTab.elements` read. The seeded tab autosaves back to the
// API on the next save cycle, healing the diagram.
export function placeholdersFromSummaries(
  summaries: { id: string; name: string; folder?: string }[],
): Tab[] {
  if (summaries.length === 0) return [createTab('Tab 1')];
  // Carry `folder` (spec/30) so the tab bar renders folders from the
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
// fetch (spec/13) is outstanding. Without this gate the canvas paints
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
  hasDiagram: boolean;
  // The active tab id is in the loaded-set (its content has landed, or
  // it was created locally so there's nothing to fetch).
  loaded: boolean;
  // The active tab's lazy fetch threw (network / 5xx).
  errored: boolean;
  elementsLength: number;
  templateChosen: boolean;
}): TabLoadState {
  // Pre-hydration / no diagram: the diagram-level loader owns the screen.
  if (!input.hydrated || !input.hasDiagram) return 'ready';
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
// reorder, AND a per-diagram folder change (spec/30) — folder rides
// the same meta-save path as order, so a folder-only edit must flip
// this even when positions are unchanged. `deletedIds` are tabs
// present at last save but gone now.
//
// `loadedTabIds` (when supplied) is the data-loss guard. Tabs hydrate
// lazily (spec/13): until a tab is opened its in-memory `elements` is an
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
  loadedTabIds?: ReadonlySet<string>,
): TabSaveDiff {
  const prevTabById = new Map(prevTabs.map((t) => [t.id, t] as const));
  const changedTabs = currentTabs
    .filter((t) => prevTabById.get(t.id) !== t)
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

// Merge AI-returned elements into the existing element list as one block
// (spec/25). Lifted out of useEditorState's `applyAiElements` so this
// non-trivial logic (id dedup, arrow-endpoint remap, clean-vs-generate
// merge) is unit-testable; the hook just wraps it in `commit`.
//
//   - `returned` elements whose id matches an existing one MODIFY it.
//   - `returned` elements with a new id are ADDED; if the AI reused a
//     short id (e.g. "ai-001") that clashes with an existing element or
//     another addition, the addition is remapped to a fresh uuid and any
//     arrow endpoints pinned to the old id are rewired to the new one so
//     connections survive.
//   - `mode: 'clean'` PRESERVES properties the AI never sees (colours,
//     images, ...) by spreading the AI patch over the existing element,
//     rather than replacing it wholesale; `'generate'` replaces in place.
//
// The result is run through `autoAlignElements` to snap the merged set to
// the grid, matching the prior inline behaviour.
export function mergeAiElements(
  existingEls: Element[],
  returned: Element[],
  mode: 'generate' | 'clean',
): Element[] {
  const existingById = new Map(existingEls.map((e) => [e.id, e]));
  const modifications = returned.filter((e) => existingById.has(e.id));
  const additions = returned.filter((e) => !existingById.has(e.id));

  // Deduplicate addition ids that clash with an existing element or with
  // each other (the AI reuses short ids like "ai-001").
  const allIds = new Set(existingEls.map((e) => e.id));
  const idMap = new Map<string, string>();
  for (const el of additions) {
    if (allIds.has(el.id)) idMap.set(el.id, crypto.randomUUID());
    else allIds.add(el.id);
  }
  const deduped: Element[] = additions.map((el) => {
    const newId = idMap.get(el.id) ?? el.id;
    if (el.type === 'arrow') {
      const from =
        el.from.kind === 'pinned' && idMap.has(el.from.elementId)
          ? { ...el.from, elementId: idMap.get(el.from.elementId)! }
          : el.from;
      const to =
        el.to.kind === 'pinned' && idMap.has(el.to.elementId)
          ? { ...el.to, elementId: idMap.get(el.to.elementId)! }
          : el.to;
      return { ...el, id: newId, from, to };
    }
    return { ...el, id: newId };
  });

  const modById = new Map(modifications.map((e) => [e.id, e]));
  // 'clean' preserves AI-invisible props by spreading the patch over the
  // existing element; 'generate' replaces the element in place.
  const merge = (el: Element): Element =>
    !modById.has(el.id)
      ? el
      : mode === 'clean'
        ? ({ ...el, ...(modById.get(el.id) as Element) } as Element)
        : (modById.get(el.id) as Element);

  // When Generate produced a whole new connected diagram (≥3 linked nodes),
  // re-lay-it-out deterministically (spec/25): the model decides structure,
  // we own the geometry — uniform sizes, layered placement, clean arrow
  // anchors. Placed in free space below existing content so it doesn't land
  // on top of the user's work. Small additive edits keep the model's
  // placement (isLayoutCandidate is false), and Clean is left untouched.
  const placed =
    mode === 'generate' && isLayoutCandidate(deduped)
      ? autoLayoutElements(deduped, freePlacement(existingEls))
      : deduped;

  return autoAlignElements([...existingEls.map(merge), ...placed]);
}

// Top-left for a freshly generated diagram: below the existing content (left
// edges aligned) with a gap, or a sensible corner on an empty canvas.
function freePlacement(existing: Element[]): { originX: number; originY: number } {
  const boxed = existing.filter(isBoxed);
  if (boxed.length === 0) return { originX: 120, originY: 100 };
  const minX = Math.min(...boxed.map((b) => b.x));
  const maxY = Math.max(...boxed.map((b) => b.y + b.height));
  return { originX: minX, originY: maxY + 120 };
}
