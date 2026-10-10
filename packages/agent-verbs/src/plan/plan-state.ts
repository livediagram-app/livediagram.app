// What every Plan write reads first (docs/specs/026-plan/plan-agents.md "Cost"): the items and the plan, in
// parallel, once per call however many changes it carries.
import type { ApiClient } from '@livediagram/api-client';
import type { ItemsResponse, PlanResponse } from '@livediagram/api-schema';
import type { Item } from '@livediagram/items';
import { itemsPath } from '../verbs/shared';

export const planPath = (documentId: string) => `/documents/${encodeURIComponent(documentId)}/plan`;
export const itemTypesPath = (documentId: string) =>
  `/documents/${encodeURIComponent(documentId)}/item-types`;

export interface PlanState {
  items: Item[];
  plan: PlanResponse;
}

export async function readPlanState(api: ApiClient, documentId: string): Promise<PlanState> {
  const [{ items }, plan] = await Promise.all([
    api.json<ItemsResponse>(itemsPath(documentId)),
    api.json<PlanResponse>(planPath(documentId)),
  ]);
  return { items, plan };
}
