'use client';

// Importing a board from another tool (docs/specs/026-plan/tracker-import.md "The import"): what the Import dialog's
// preview plans against (the plan's card types, states, people and room), and the writes that make it. The file is
// read and planned in the dialog's own chunk (useTrackerFlow); this only reads the plan and writes.
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEMS_MAX,
  assignedPeople,
  createBatches,
  planOutline,
  trackerDoneMessage,
  type Item,
  type ItemPerson,
  type ItemTypeCatalogue,
  type ItemTypeDef,
  type ItemWrite,
  type TrackerImportPlan,
  type TrackerMember,
  type TrackerPlanContext,
} from '@liveplanner/items';
import { withImportedThreads, type Tab } from '@liveplanner/project';
import { creationIntentOf } from '@liveplanner/api-schema';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { apiCreateProject, apiTeamMembers } from '@/lib/api-client';
import { writeItem } from '@/lib/api/items';
import { offlineCreateProject } from '@/lib/offline/offline-store';
import { offlineWriteItem } from '@/lib/offline/offline-items';
import { seedAuthor } from '@/lib/seed-author';
import { newTabSeed } from '@/lib/new-tab-seed';
import { track } from '@/lib/telemetry';
import { waitUntil } from '@/lib/wait-until';
import { insertTabsAfter } from '@/app/project/[id]/template-tab-set';
import type { PlanItemsStatus } from './usePlanItems';
import { teamMemberPerson } from './useTeamPeople';

export type TrackerTarget = 'tab' | 'plan';

export type TrackerImportOutcome = { ok: true } | { ok: false; error: string };

export type TrackerImportActions = {
  // An import makes a tab, columns and a card type: an Editor's (tracker-import.md "Who may").
  canImport: boolean;
  // What an import into `target` plans against; null when the plan's cards never loaded.
  contextFor: (target: TrackerTarget) => Promise<TrackerPlanContext | null>;
  // Writes `plan`, planned against contextFor(target).
  importPlan: (plan: TrackerImportPlan, target: TrackerTarget) => Promise<TrackerImportOutcome>;
};

// The dialog's failure sentence (tracker-import.md "The import").
export const TRACKER_IMPORT_FAILED = 'Couldn’t import those cards. Try again.';

// How long an import waits for the item store, as a JSON import does (usePlanTabImport).
const TRACKER_READY_WAIT_MS = 10_000;

const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

// The joined members of the plan's team with an email, by that email (lower-cased); none on a failure.
async function teamMembersOf(ownerId: string, teamId: string): Promise<TrackerMember[]> {
  try {
    const out: TrackerMember[] = [];
    for (const m of await apiTeamMembers(ownerId, teamId)) {
      const person = m.email ? await teamMemberPerson(m) : null;
      if (person && m.email) out.push({ email: m.email.trim().toLowerCase(), person });
    }
    return out;
  } catch (err) {
    console.warn('[tracker-import] team members failed', { error: String(err) });
    return [];
  }
}

// The Board tab an import makes: named after the board, its board filling it with its cards Detailed.
export function trackerBoardTab(plan: TrackerImportPlan, base: Tab, look?: Tab): Tab {
  return {
    ...base,
    ...newTabSeed(look),
    id: base.id,
    name: plan.title,
    kind: 'board',
    elements: [plan.board],
  };
}

export function useTrackerImport(opts: {
  canImport: boolean;
  projectId: string | null;
  ownerId: string;
  signedIn: boolean;
  // The plan's team, when the token names it (useTeamPeople's rule); null reads no members.
  teamId: string | null;
  self: ItemPerson | null;
  selfParticipant: { id: string; name: string; color: string };
  teamPeople: readonly ItemPerson[];
  status: PlanItemsStatus;
  items: ReadonlyMap<string, Item>;
  tabs: readonly Tab[];
  activeId: string;
  catalogue: ItemTypeCatalogue | null;
  types: readonly ItemTypeDef[];
  saveType: (type: ItemTypeDef) => void;
  write: (write: ItemWrite) => Promise<boolean>;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  createTab: (name: string) => Tab;
  markTabLoaded: (tabId: string) => void;
  openTab: (tabId: string) => void;
  openProject: (projectId: string) => void;
  notify: (message: string) => void;
  readyWaitMs?: number;
}): TrackerImportActions {
  // Read when used: the store loads and changes while the dialog is open.
  const latest = useLatest(opts);

  const contextFor = async (target: TrackerTarget): Promise<TrackerPlanContext | null> => {
    const boardId = crypto.randomUUID();
    // A new plan starts empty: no card types, states or people, room for every card.
    if (target === 'plan')
      return { types: [], statuses: [], people: [], members: [], room: ITEMS_MAX, boardId };
    const ready = await waitUntil(
      () => latest.current.status === 'ready',
      latest.current.readyWaitMs ?? TRACKER_READY_WAIT_MS,
    );
    if (!ready) {
      debugLog('[tracker-import] store not ready', { status: latest.current.status });
      return null;
    }
    const o = latest.current;
    const members =
      o.signedIn && o.teamId ? await teamMembersOf(o.ownerId, o.teamId) : ([] as TrackerMember[]);
    const items = [...o.items.values()];
    return {
      types: o.types,
      statuses: planOutline(o.tabs, o.catalogue).statuses,
      people: [...(o.self ? [o.self] : []), ...o.teamPeople, ...assignedPeople(items)],
      members,
      room: ITEMS_MAX - items.length,
      boardId,
    };
  };

  const intoTab = async (plan: TrackerImportPlan): Promise<TrackerImportOutcome> => {
    const o = latest.current;
    if (!o.projectId) return { ok: false, error: TRACKER_IMPORT_FAILED };
    // The card type, added or merged: one undo step, skipped when the plan already has it as it is.
    const own = o.types.find((t) => t.id === plan.type.id);
    if (!own || JSON.stringify(own) !== JSON.stringify(plan.type)) o.saveType(plan.type);
    // The tab after the open one, in its look, opened: one undo step.
    const tab = trackerBoardTab(
      plan,
      o.createTab(plan.title),
      o.tabs.find((t) => t.id === o.activeId),
    );
    o.commitTabs((ts) => insertTabsAfter(ts, o.activeId, [tab]));
    o.markTabLoaded(tab.id);
    o.openTab(tab.id);
    // Every card in one write, each with its Imported comments thread: one undo step.
    const creates = withImportedThreads(plan.creates, {
      projectId: o.projectId,
      sourceName: plan.sourceName,
      now: Date.now(),
    });
    const ok = await o.write({ kind: 'create', creates });
    if (!ok) return { ok: false, error: TRACKER_IMPORT_FAILED };
    track('Plan', 'Imported', plan.sourceName);
    o.notify(trackerDoneMessage(plan.preview, plan.creates.length));
    return { ok: true };
  };

  const asPlan = async (plan: TrackerImportPlan): Promise<TrackerImportOutcome> => {
    const o = latest.current;
    const id = crypto.randomUUID();
    const tab = trackerBoardTab(plan, o.createTab(plan.title));
    const itemTypes: ItemTypeCatalogue = {
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: [plan.type],
    };
    const creates = withImportedThreads(plan.creates, {
      projectId: id,
      sourceName: plan.sourceName,
      now: Date.now(),
    });
    const head = { id, name: plan.title, tabs: [tab], itemTypes };
    if (o.signedIn) {
      // One create carries the tab, the card type and the cards its request has room for; the rest follow it.
      const [first = [], ...rest] = createBatches(creates, bytesOf(head));
      await apiCreateProject(o.ownerId, { ...head, intent: creationIntentOf(tab), items: first });
      if (rest.length)
        await writeItem(
          { ownerId: o.ownerId, projectId: id, shareCode: null, tabId: null },
          { kind: 'create', creates: rest.flat() },
          o.self ?? (await seedAuthor(o.selfParticipant)),
        );
    } else {
      // A guest's new plan is in This Browser, as New makes it (save-locations.md).
      await offlineCreateProject(head, Date.now());
      await offlineWriteItem(
        id,
        { kind: 'create', creates },
        o.self ?? (await seedAuthor(o.selfParticipant)),
      );
    }
    track('Plan', 'Imported', plan.sourceName);
    o.openProject(id);
    return { ok: true };
  };

  const importPlan = async (
    plan: TrackerImportPlan,
    target: TrackerTarget,
  ): Promise<TrackerImportOutcome> => {
    if (!latest.current.canImport) return { ok: false, error: TRACKER_IMPORT_FAILED };
    try {
      const outcome = await (target === 'tab' ? intoTab(plan) : asPlan(plan));
      debugLog('[tracker-import] done', { target, cards: plan.creates.length, ok: outcome.ok });
      return outcome;
    } catch (err) {
      console.warn('[tracker-import] failed', { target, error: String(err) });
      return { ok: false, error: TRACKER_IMPORT_FAILED };
    }
  };

  return { canImport: opts.canImport, contextFor, importPlan };
}
