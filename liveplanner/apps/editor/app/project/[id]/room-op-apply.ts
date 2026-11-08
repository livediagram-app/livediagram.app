import { applyMergedElementOps } from '@liveworkspace/workbench/lib/merged-element-ops';
import type { RemoteOp } from '@liveworkspace/workbench/lib/remote-op-log';
import { carryConnection } from '@liveworkspace/workbench/components/connect/tab-connection';
import {
  applyDashboardPatch,
  settleTabFields,
  applyElementDelta,
  applyElementOps,
  applyRoomElementOp,
  applyVoteDelta,
  mergeIncomingElement,
  voteDeltaApplies,
  type ElementDelta,
  type DashboardPatch,
  type ElementOp,
  type Tab,
} from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';
import { META_SKIP, mergeRemoteTab, mergeRemoteVote } from './tab-broadcast-ops';

// The project-changing room ops, as a pure function over a tab list.
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
// One peer's layout delta reaches the present and, when they are restored or the op log fills, the undo and redo
// snapshots (historyApplyRemoteOp), which share unchanged tabs. Remembering each tab's result for the delta's patch
// applies it once per distinct tab, not once per snapshot, and keeps the snapshots sharing one result rather than
// holding up to 1,000 copies of the layout.
const dashboardApplied = new WeakMap<DashboardPatch, WeakMap<Tab, Tab>>();

function applyDashboardDelta(tab: Tab, patch: DashboardPatch): Tab {
  if (!tab.dashboard) return tab;
  let seen = dashboardApplied.get(patch);
  if (!seen) dashboardApplied.set(patch, (seen = new WeakMap()));
  const known = seen.get(tab);
  if (known) return known;
  const dashboard = applyDashboardPatch(tab.dashboard, patch);
  const next = dashboard === tab.dashboard ? tab : { ...tab, dashboard };
  seen.set(tab, next);
  return next;
}

export function applyRoomOpToTabs(tabs: Tab[], op: RoomOp): Tab[] {
  switch (op.kind) {
    case 'tab': {
      // A peer's whole tab. A tab we don't have yet (they just added it) is
      // appended; otherwise merged, keeping our folder and our dots.
      // The tab keeps the id the op names: a payload naming another would renumber it here, and the next save
      // would write it over that other tab (the room drops such an op too, room-op-gate.ts).
      if (!tabs.some((t) => t.id === op.tabId)) return [...tabs, { ...op.tab, id: op.tabId }];
      return updateTab(tabs, op.tabId, (tab) => ({
        ...mergeRemoteTab(tab, op.tab, { dashboardDeltas: op.dashboardDeltas === true }),
        id: tab.id,
      }));
    }
    case 'el':
      // ONE element, applied by id (docs/specs/012-collaboration/realtime-conflict-resolution.md). An op for a tab we don't have is
      // dropped: a follow-up `tab` or `project-meta` op brings it in whole.
      return updateTab(tabs, op.tabId, (tab) => {
        // An add / update is merged, not swapped in: answers, ticks and
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
    case 'dashboard-delta':
      // ONE change to a Dashboard's layout, by row and slot id (docs/specs/012-collaboration/collab-race-hardening.md
      // "A Dashboard's layout travels as deltas"), so a peer's change to another row or slot merges with ours. Only
      // onto a layout we have: a tab that is not a Dashboard here waits for the whole layout.
      return updateTab(tabs, op.tabId, (tab) => applyDashboardDelta(tab, op.patch));
    case 'changeset': {
      // An agent's changeset (docs/specs/024-agents/agent-changesets.md "In the editor"): a tab it
      // created is appended first, then each element op applies exactly as case `el` does. An op
      // relayed without its element ops (over the relay cap) brings only a created tab here: the
      // editor re-fetches the content.
      const ops = op.elementOps ?? [];
      const created =
        op.tab && !tabs.some((t) => t.id === op.tabId)
          ? [...tabs, { ...op.tab, id: op.tabId, elements: [] }]
          : tabs;
      // A Dashboard it rebuilt brings its new layout, taken whole (collab-race-hardening.md "A Dashboard's layout
      // travels as deltas"): a reset, as the room's ledger records it.
      const rebuilt = op.dashboard;
      const withTab = rebuilt
        ? updateTab(created, op.tabId, (tab) => ({ ...tab, dashboard: rebuilt }))
        : created;
      if (ops.length === 0) return withTab;
      return applyChangesetRun(withTab, op.tabId, ops);
    }
    case 'vote':
      // ONE dot, as a delta, so concurrent dots commute (docs/specs/012-collaboration/session-tools.md). Dropped
      // unless casting is open for the round it was cast in (docs/specs/012-collaboration/collab-race-hardening.md).
      return updateTab(tabs, op.tabId, (tab) => {
        if (!tab.vote || !voteDeltaApplies(tab.vote, op.round)) return tab;
        const vote = applyVoteDelta(tab.vote, op.elementId, op.voter, op.delta);
        return vote === tab.vote ? tab : { ...tab, vote };
      });
    case 'tab-meta':
      // Non-element fields (docs/specs/012-collaboration/realtime-conflict-resolution.md). `folder` stays owned by project-meta
      // (docs/specs/006-project/tab-folders.md); a `vote` in the patch follows the round rule, so an End or
      // a Reveal can't erase dots still in flight.
      return updateTab(tabs, op.tabId, (tab) => {
        // Only non-element fields: never the id, elements or folder (META_SKIP), whatever the patch carries.
        const patch = Object.fromEntries(
          Object.entries(op.patch ?? {}).filter(([key]) => !META_SKIP.has(key)),
        ) as Partial<Omit<Tab, 'elements'>>;
        const merged: Tab = { ...tab, ...patch, id: tab.id, folder: tab.folder };
        if ('vote' in patch) {
          const vote = mergeRemoteVote(tab.vote, patch.vote);
          if (vote === undefined) delete merged.vote;
          else merged.vote = vote;
        }
        // Fields the sender removed (docs/specs/012-collaboration/collab-race-hardening.md); never one a patch can't touch.
        for (const key of Array.isArray(op.clear) ? op.clear : []) {
          if (!META_SKIP.has(key)) delete (merged as Record<string, unknown>)[key];
        }
        // A peer's patch is untrusted like any incoming tab: its raw-read fields are settled.
        return settleTabFields(merged);
      });
    case 'project-meta': {
      // Rename / reorder / add / delete. Reorder to match; a new id lands as a
      // placeholder a follow-up `tab` op fills. Unchanged tabs keep identity
      // (the autosave keys off it); project-meta owns folder membership.
      const localById = new Map(tabs.map((t) => [t.id, t] as const));
      // A summary's connection (a connected tab the index added, or connected again) lands on the tab; one that
      // carries none (an agent's rename relay) leaves the tab's own (carryConnection).
      return op.tabs.map((summary) => {
        const local = localById.get(summary.id);
        if (local) {
          const folder = summary.folder;
          return carryConnection(
            (local.folder ?? undefined) === (folder ?? undefined) ? local : { ...local, folder },
            summary,
          );
        }
        return carryConnection(
          { id: summary.id, name: summary.name, elements: [], folder: summary.folder },
          summary,
        );
      });
    }
    default:
      return tabs;
  }
}

// ONE answer / tick / comment on one element (docs/specs/012-collaboration/collab-race-hardening.md), through the
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

// A run of element ops on one tab, each merged over the element as the ops before it left it, all applied in one
// pass (applyMergedElementOps): a run of peers' `el` ops an undo snapshot takes together (remoteRoomOp). It costs the
// tab's size plus the ops', not one walk of the tab per op. `keepBoard` is the merge's: a person's `el` keeps our
// board set-up (it reached us as deltas), an agent's changeset, which sends none, has its own taken.
function applyMergedRun(
  tabs: Tab[],
  tabId: string,
  ops: readonly unknown[],
  keepBoard: boolean,
): Tab[] {
  return updateTab(tabs, tabId, (tab) => {
    const elements = applyMergedElementOps(
      tab.elements,
      ops as ElementOp[],
      (local, incoming) =>
        mergeIncomingElement(local, incoming, keepBoard ? {} : { keepBoard: false }),
      applyElementOps,
    );
    return elements === tab.elements ? tab : { ...tab, elements };
  });
}

// Two runs, so a peer's `el` ops and an agent's changeset ops never join one merge.
const applyElementRun = (tabs: Tab[], tabId: string, ops: readonly unknown[]): Tab[] =>
  applyMergedRun(tabs, tabId, ops, true);
const applyChangesetRun = (tabs: Tab[], tabId: string, ops: readonly unknown[]): Tab[] =>
  applyMergedRun(tabs, tabId, ops, false);

// The op as the undo history logs it (historyApplyRemoteOp, docs/specs/012-collaboration/realtime-conflict-resolution.md
// "Locked decisions"): a pure function of the tabs, and for an element op (a peer's `el`, a changeset that creates
// no tab and rebuilds no Dashboard) the run it can join with the ops beside it, so a snapshot catching up on many of
// them walks the tab once.
export function remoteRoomOp(op: RoomOp): RemoteOp<Tab[]> {
  const apply = (tabs: Tab[]) => applyRoomOpToTabs(tabs, op);
  const run = elementRunOf(op);
  return run ? Object.assign(apply, { run }) : apply;
}

// The element ops an op applies to one tab whatever else the tabs hold: a non-patch `el` op, or a changeset that
// creates no tab and rebuilds no Dashboard. Anything else is applied alone.
function elementRunOf(op: RoomOp): RemoteOp<Tab[]>['run'] | null {
  if (op.kind === 'el') {
    return op.op.kind === 'patch'
      ? null
      : { key: op.tabId, items: [op.op], applyAll: applyElementRun };
  }
  if (op.kind === 'changeset' && !op.tab && !op.dashboard) {
    return { key: op.tabId, items: op.elementOps ?? [], applyAll: applyChangesetRun };
  }
  return null;
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
