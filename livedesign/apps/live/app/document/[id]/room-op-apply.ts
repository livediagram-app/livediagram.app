import {
  settleTabFields,
  applyElementDelta,
  applyElementOp,
  applyRoomElementOp,
  mergeIncomingElement,
  type ElementDelta,
  type ElementOp,
  type Tab,
} from '@livedesign/document';
import { applyPhotoOps, isPhotoPageId, parsePhotoOps, type Photo } from '@livedesign/photo-engine';
import { blankPhoto, pagesOf, photosOf } from '@livedesign/document';
import type { RoomOp } from '@livedesign/api-schema';
import { META_SKIP, mergeRemoteTab } from './tab-broadcast-ops';

// The document-changing room ops, as a pure function over a tab list.
//
// ONE definition, applied twice (docs/specs/012-collaboration/collab-race-hardening.md): to the tabs on screen when a
// peer's op arrives, and to the autosave's baseline (`lastSavedTabsRef`), the
// record of what peers already have. The baseline used to ignore remote ops,
// so the next local save diffed against a pre-remote snapshot and re-broadcast
// every peer's element in its local, possibly older, form. Applying the same
// op the same way to both keeps them from drifting.
//
// Returns `tabs` itself when the op changes nothing (an op for a tab we don't
// have, an update for a removed element), so callers keep identity and the autosave sees no phantom change.
export function applyRoomOpToTabs(tabs: Tab[], op: RoomOp): Tab[] {
  switch (op.kind) {
    case 'tab': {
      // A peer's whole tab. A tab we don't have yet (they just added it) is
      // appended; otherwise merged, keeping our folder.
      if (!tabs.some((t) => t.id === op.tabId)) return [...tabs, op.tab];
      return updateTab(tabs, op.tabId, (tab) => mergeRemoteTab(tab, op.tab));
    }
    case 'el':
      // ONE element, applied by id (docs/specs/012-collaboration/realtime-conflict-resolution.md). An op for a tab we don't have is
      // dropped: a follow-up `tab` or `document-meta` op brings it in whole.
      return updateTab(tabs, op.tabId, (tab) => {
        // An add / update is merged, not swapped in: ticks and
        // comments reached us as deltas and ours is the merged copy, where the
        // sender's is a snapshot from their last save (docs/specs/012-collaboration/collab-race-hardening.md).
        const elOp =
          op.op.kind === 'update' || op.op.kind === 'add' ? mergeOpOverLocal(tab, op.op) : op.op;
        // A patch (a Participant's change, relayed by the room) touches only the fields it names.
        const elements = applyRoomElementOp(tab.elements, elOp);
        return elements === tab.elements ? tab : { ...tab, elements };
      });
    case 'el-delta':
      return applyDeltaToTabs(tabs, op.tabId, op.elementId, op.delta);
    case 'changeset': {
      // An agent's changeset (docs/specs/024-agents/agent-changesets.md "In the editor"): a tab it
      // created is appended first, then each element op applies exactly as case `el` does. An op
      // relayed without its element ops (over the relay cap) brings only a created tab here: the
      // editor re-fetches the content.
      const ops = op.elementOps ?? [];
      const withTab =
        op.tab && !tabs.some((t) => t.id === op.tabId)
          ? [...tabs, { ...op.tab, id: op.tabId, elements: [] }]
          : tabs;
      if (ops.length === 0) return withTab;
      return updateTab(withTab, op.tabId, (tab) => {
        let elements = tab.elements;
        for (const elOp of ops) {
          const merged =
            elOp.kind === 'update' || elOp.kind === 'add'
              ? mergeOpOverLocal({ ...tab, elements }, elOp)
              : elOp;
          elements = applyElementOp(elements, merged);
        }
        return elements === tab.elements ? tab : { ...tab, elements };
      });
    }
    case 'tab-meta':
      // Non-element fields (docs/specs/012-collaboration/realtime-conflict-resolution.md). `folder` stays owned by document-meta
      // (docs/specs/006-document/tab-folders.md).
      return updateTab(tabs, op.tabId, (tab) => {
        const { folder: _ignored, ...patch } = op.patch;
        const merged: Tab = { ...tab, ...patch, folder: tab.folder };
        // Fields the sender removed (docs/specs/012-collaboration/collab-race-hardening.md); never one a patch can't touch.
        for (const key of Array.isArray(op.clear) ? op.clear : []) {
          if (!META_SKIP.has(key)) delete (merged as Record<string, unknown>)[key];
        }
        // A peer's patch is untrusted like any incoming tab: its raw-read fields are settled.
        return settleTabFields(merged);
      });
    case 'photo':
      // ONE photo page's layers, applied by layer id (docs/specs/031-photo/photo-store.md "Live
      // sync"): different layers merge, the later commit wins on the same one.
      return updateTab(tabs, op.tabId, (tab) => {
        if (!isPhotoPageId(op.pageId)) return tab;
        const raw: Record<string, Photo> = tab.photos ?? {};
        if ('removed' in op) {
          if (!Object.hasOwn(raw, op.pageId)) return tab;
          const { [op.pageId]: _gone, ...rest } = raw;
          void _gone;
          if (Object.keys(rest).length > 0) return { ...tab, photos: rest };
          const { photos: _drop, ...noPhotos } = tab;
          void _drop;
          return noPhotos;
        }
        const ops = parsePhotoOps(op.ops);
        if (!ops) return tab;
        // A photo this tab has no page for (deleted while the peer painted) is dropped.
        if (!pagesOf(tab).some((p) => p.id === op.pageId && p.kind === 'photo')) return tab;
        const current = photosOf(tab)[op.pageId] ?? blankPhoto();
        const next = applyPhotoOps(current, ops);
        if (next === current) return tab;
        return { ...tab, photos: { ...raw, [op.pageId]: next } };
      });
    case 'document-meta': {
      // Rename / reorder / add / delete. Reorder to match; a new id lands as a
      // placeholder a follow-up `tab` op fills. Unchanged tabs keep identity
      // (the autosave keys off it); document-meta owns folder membership.
      const localById = new Map(tabs.map((t) => [t.id, t] as const));
      return op.tabs.map((summary) => {
        const local = localById.get(summary.id);
        if (local) {
          const folder = summary.folder;
          return (local.folder ?? undefined) === (folder ?? undefined)
            ? local
            : { ...local, folder };
        }
        return { id: summary.id, name: summary.name, elements: [], folder: summary.folder };
      });
    }
    default:
      return tabs;
  }
}

// ONE tick / comment on one element (docs/specs/012-collaboration/collab-race-hardening.md), through the
// pure function every peer runs, so concurrent presses on the same card
// commute. Shared by the receiver above and the sender (useElementDeltas), so
// the two can't apply a delta differently.
export function applyDeltaToTabs(
  tabs: Tab[],
  tabId: string,
  elementId: string,
  delta: ElementDelta,
): Tab[] {
  return updateTab(tabs, tabId, (tab) => {
    const i = tab.elements.findIndex((el) => el.id === elementId);
    if (i === -1) return tab;
    const next = applyElementDelta(tab.elements[i]!, delta);
    if (next === tab.elements[i]) return tab;
    const elements = [...tab.elements];
    elements[i] = next;
    return { ...tab, elements };
  });
}

// Replace one tab by id, keeping the array (and so the autosave's identity
// check) when there is no such tab or `fn` changes nothing.
function updateTab(tabs: Tab[], tabId: string, fn: (tab: Tab) => Tab): Tab[] {
  const i = tabs.findIndex((t) => t.id === tabId);
  if (i === -1) return tabs;
  const next = fn(tabs[i]!);
  if (next === tabs[i]) return tabs;
  const out = [...tabs];
  out[i] = next;
  return out;
}

// An incoming add / update, with the element merged over our copy of it when
// we have one. A racing double-add degrades to an update in applyElementOp,
// so it gets the same merge.
function mergeOpOverLocal(tab: Tab, op: Extract<ElementOp, { kind: 'add' | 'update' }>): ElementOp {
  const local = tab.elements.find((e) => e.id === op.element.id);
  if (!local) return op;
  return { ...op, element: mergeIncomingElement(local, op.element) };
}
