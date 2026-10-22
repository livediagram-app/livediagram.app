// What every Plan write reads first (docs/specs/026-plan/plan-agents.md "Cost"): the items and the plan, in
// parallel, once per call however many changes it carries.
import type { ApiClient } from '@liveplanner/api-client';
import type { ItemsResponse, PlanResponse } from '@liveplanner/api-schema';
import { ApiError } from '@liveplanner/api-client';
import type { Item } from '@liveplanner/items';
import { itemsPath } from '../verbs/shared';

export const planPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/plan`;
export const itemTypesPath = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/item-types`;

// How many times a change of card types is made again when another change landed first (409 `item_types_stale`,
// docs/specs/026-plan/item-types.md "Storage and sync"): each attempt reads the card types afresh.
export const CARD_TYPES_SAVE_ATTEMPTS = 3;

export function isCardTypesStale(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'item_types_stale';
}

export interface PlanState {
  items: Item[];
  plan: PlanResponse;
}

export async function readPlanState(api: ApiClient, projectId: string): Promise<PlanState> {
  const [{ items }, plan] = await Promise.all([
    api.json<ItemsResponse>(itemsPath(projectId)),
    api.json<PlanResponse>(planPath(projectId)),
  ]);
  return { items, plan };
}
