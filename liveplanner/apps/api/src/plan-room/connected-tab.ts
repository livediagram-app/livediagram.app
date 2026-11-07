// A connected tab the index adds to this plan (liveworkspace/docs/specs/004-index/connected-tabs.md "Both ways"):
// the reverse of a connection made both ways, written through the internal door (routes/internal-items.ts) with the
// app's INDEX_KEY. The kit appends it (@liveworkspace/index-app connected-tabs.ts): an empty tab, loose, at the end of
// the tab bar, holding the connection in its column; this is how liveplanner stores the tab, and the project-meta
// op that shows it to everyone with the plan open.

import { appendConnectedTab, type ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import type { RoomOp } from '@liveplanner/api-schema';
import { tabWriteStatements } from '../db/tabs';
import type { PlanEnv } from '../types';
import { readPlanMeta, readPlanOutline } from './plan-content';

// The reverse write, or `not_found` for a plan not started.
export async function addConnectedPlanTab(
  env: PlanEnv,
  planId: string,
  write: ConnectedTabWrite,
): Promise<ConnectedTabOutcome> {
  if (!(await readPlanMeta(env, planId))) return 'not_found';
  return appendConnectedTab(env.PLAN_DB, planId, write, {
    linkTable: 'plan_tabs',
    itemColumn: 'plan_id',
    // Stored as any new tab is: an empty canvas tab (no kind, no elements), its place, its stats and the plan's
    // save time.
    insertTab: (tabId, name, orderIndex) =>
      tabWriteStatements(env, planId, { id: tabId, name, elements: [] }, orderIndex, {
        advance: true,
      }),
  });
}

// The plan's tabs as an editor's own tab add sends them, so open editors place the new tab where it is.
export async function connectedTabArrival(env: PlanEnv, planId: string): Promise<RoomOp | null> {
  const outline = await readPlanOutline(env, planId);
  if (!outline.meta) return null;
  return {
    kind: 'project-meta',
    name: outline.meta.name,
    tabs: outline.tabs.map((t) => ({
      id: t.id,
      name: t.name,
      orderIndex: t.orderIndex,
      ...(t.folder ? { folder: t.folder } : {}),
      ...(t.connection ? { connection: t.connection } : {}),
    })),
  };
}
