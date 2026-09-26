import {
  applyElementDelta,
  applyElementOp,
  applyVoteDelta,
  mergeIncomingElement,
  voteDeltaApplies,
  type ElementDelta,
  type ElementOp,
  type Tab,
} from '@livediagram/diagram';
import type { RoomOp } from '@livediagram/api-schema';
import { META_SKIP, mergeRemoteTab, mergeRemoteVote } from './tab-broadcast-ops';

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
// have, an update for a removed element, a dot for a closed round), so callers
// keep identity and the autosave sees no phantom change.
export function applyRoomOpToTabs(tabs: Tab[], op: RoomOp): Tab[] {
  switch (op.kind) {
    case 'tab': {
      // A peer's whole tab. A tab we don't have yet (they just added it) is
      // appended; otherwise merged, keeping our folder and our dots.
      if (!tabs.some((t) => t.id === op.tabId)) return [...tabs, op.tab];
      return updateTab(tabs, op.tabId, (tab) => mergeRemoteTab(tab, op.tab));
    }
    case 'el':
      // ONE element, applied by id (docs/specs/012-collaboration/realtime-conflict-resolution.md). An op for a tab we don't have is
      // dropped: a follow-up `tab` or `diagram-meta` op brings it in whole.
      return updateTab(tabs, op.tabId, (tab) => {
        // An add / update is merged, not swapped in: answers, ideas, ticks and
        // comments reached us as deltas and ours is the merged copy, where the
        // sender's is a snapshot from their last save (docs/specs/012-collaboration/collab-race-hardening.md).
        const elOp =
          op.op.kind === 'update' || op.op.kind === 'add' ? mergeOpOverLocal(tab, op.op) : op.op;
        const elements = applyElementOp(tab.elements, elOp);
        return elements === tab.elements ? tab : { ...tab, elements };
      });
    case 'el-delta':
      return applyDeltaToTabs(tabs, op.tabId, op.elementId, op.delta);
    case 'vote':
      // ONE dot, as a delta, so concurrent dots commute (docs/specs/012-collaboration/session-tools.md). Dropped
      // unless casting is open for the round it was cast in (docs/specs/012-collaboration/collab-race-hardening.md).
      return updateTab(tabs, op.tabId, (tab) => {
        if (!tab.vote || !voteDeltaApplies(tab.vote, op.round)) return tab;
        const vote = applyVoteDelta(tab.vote, op.elementId, op.voter, op.delta);
        return vote === tab.vote ? tab : { ...tab, vote };
      });
    case 'tab-meta':
      // Non-element fields (docs/specs/012-collaboration/realtime-conflict-resolution.md). `folder` stays owned by diagram-meta
      // (docs/specs/006-diagram/tab-folders.md); a `vote` in the patch follows the round rule, so an End or
      // a Reveal can't erase dots still in flight.
      return updateTab(tabs, op.tabId, (tab) => {
        const { folder: _ignored, ...patch } = op.patch;
        const merged: Tab = { ...tab, ...patch, folder: tab.folder };
        if ('vote' in patch) {
          const vote = mergeRemoteVote(tab.vote, patch.vote);
          if (vote === undefined) delete merged.vote;
          else merged.vote = vote;
        }
        // Fields the sender removed (docs/specs/012-collaboration/collab-race-hardening.md); never one a patch can't touch.
        for (const key of Array.isArray(op.clear) ? op.clear : []) {
          if (!META_SKIP.has(key)) delete (merged as Record<string, unknown>)[key];
        }
        return merged;
      });
    case 'diagram-meta': {
      // Rename / reorder / add / delete. Reorder to match; a new id lands as a
      // placeholder a follow-up `tab` op fills. Unchanged tabs keep identity
      // (the autosave keys off it); diagram-meta owns folder membership.
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

// ONE answer / idea / tick / comment on one element (docs/specs/012-collaboration/collab-race-hardening.md), through the
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
