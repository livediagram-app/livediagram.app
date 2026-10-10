// A document's plan for agents (docs/specs/026-plan/plan-agents.md "Reading the plan"): GET
// /api/documents/:id/plan answers its Plan boards, the statuses they name and the card types, built by
// @livediagram/items' planOutline. Read access as the items' list: a grant confined to one tab names it and sees
// that tab's boards only. Only tabs holding a board are read, a batch at a time, and reduced to board set-ups.

import type { PlanResponse } from '@livediagram/api-schema';
import { planOutline, type PlanTabInput } from '@livediagram/items';
import { getTab, tabBodiesWithBoards } from '../db';
import { json, methodNotAllowed } from '../responses';
import type { RouteContext } from './context';
import { itemCaller } from './item-route-kit';

// Tabs read per query: the document overview's batch (document-views-route.ts).
export const PLAN_TAB_BATCH = 20;

const asInput = (tab: { id: string; name: string; elements: unknown }): PlanTabInput => ({
  id: tab.id,
  name: tab.name,
  elements: Array.isArray(tab.elements) ? (tab.elements as unknown[]) : [],
});

async function planTabs(ctx: RouteContext, documentId: string, tabId: string | null) {
  if (tabId !== null) {
    const tab = await getTab(ctx.env, documentId, tabId);
    return tab ? [asInput(tab)] : [];
  }
  const tabs: PlanTabInput[] = [];
  for (let offset = 0; ; offset += PLAN_TAB_BATCH) {
    const page = await tabBodiesWithBoards(ctx.env, documentId, offset, PLAN_TAB_BATCH);
    tabs.push(...page.map(asInput));
    if (page.length < PLAN_TAB_BATCH) return tabs;
  }
}

export async function handlePlanRoute(ctx: RouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 4 || segments[3] !== 'plan') return null;
  if (request.method !== 'GET') return methodNotAllowed();
  const documentId = segments[2]!;
  const caller = await itemCaller(ctx, documentId, 'read');
  if (caller instanceof Response) return caller;
  const scopedTab = caller.scope ? ctx.url.searchParams.get('tabId') : null;
  const plan = planOutline(await planTabs(ctx, documentId, scopedTab), caller.doc?.itemTypes);
  console.info('[plan] read', { boards: plan.boards.length, scoped: scopedTab !== null });
  const answer: PlanResponse = { ...plan, itemTypesRev: caller.doc?.itemTypesRev ?? 0 };
  return json(answer);
}
