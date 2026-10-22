// A project's plan for agents (docs/specs/026-plan/plan-agents.md "Reading the plan"): GET
// /api/projects/:id/plan answers its Plan boards, the statuses they name and the card types, built by
// @liveplanner/items' planOutline, and its tabs (id, name, kind, a Sheet tab's sheets). Read access as the items' list: a grant confined to one tab names it and sees
// that tab's boards only. Only tabs holding a board are read, a batch at a time, and reduced to board set-ups.

import type { PlanResponse } from '@liveplanner/api-schema';
import { planOutline, type PlanTabInput } from '@liveplanner/items';
import { getTab, tabBodiesWithBoards, tabOutlines } from '../db';
import { json, methodNotAllowed } from '../responses';
import type { RouteContext } from './context';
import { itemCaller } from './item-route-kit';

// Tabs read per query: the project overview's batch (project-views-route.ts).
export const PLAN_TAB_BATCH = 20;

const asInput = (tab: { id: string; name: string; elements: unknown }): PlanTabInput => ({
  id: tab.id,
  name: tab.name,
  elements: Array.isArray(tab.elements) ? (tab.elements as unknown[]) : [],
});

async function planTabs(ctx: RouteContext, projectId: string, tabId: string | null) {
  if (tabId !== null) {
    const tab = await getTab(ctx.env, projectId, tabId);
    return tab ? [asInput(tab)] : [];
  }
  const tabs: PlanTabInput[] = [];
  for (let offset = 0; ; offset += PLAN_TAB_BATCH) {
    const page = await tabBodiesWithBoards(ctx.env, projectId, offset, PLAN_TAB_BATCH);
    tabs.push(...page.map(asInput));
    if (page.length < PLAN_TAB_BATCH) return tabs;
  }
}

export async function handlePlanRoute(ctx: RouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 4 || segments[3] !== 'plan') return null;
  if (request.method !== 'GET') return methodNotAllowed();
  const projectId = segments[2]!;
  const caller = await itemCaller(ctx, projectId, 'read');
  if (caller instanceof Response) return caller;
  const scopedTab = caller.scope ? ctx.url.searchParams.get('tabId') : null;
  const [boardTabs, tabs] = await Promise.all([
    planTabs(ctx, projectId, scopedTab),
    tabOutlines(ctx.env, projectId, scopedTab),
  ]);
  const plan = planOutline(boardTabs, caller.doc?.itemTypes);
  console.info('[plan] read', { boards: plan.boards.length, scoped: scopedTab !== null });
  const answer: PlanResponse = { ...plan, tabs, itemTypesRev: caller.doc?.itemTypesRev ?? 0 };
  return json(answer);
}
