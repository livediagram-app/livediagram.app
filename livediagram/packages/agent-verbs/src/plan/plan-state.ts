// What every Plan write reads first (docs/specs/026-plan/plan-agents.md "Cost"): the items and the plan, in
// parallel, once per call however many changes it carries.
import type { ApiClient } from '@livediagram/api-client';
import type { ItemsResponse, PlanResponse } from '@livediagram/api-schema';
import { ApiError } from '@livediagram/api-client';
import type { Item } from '@livediagram/items';
import { itemsPath } from '../verbs/shared';

export const planPath = (documentId: string) => `/documents/${encodeURIComponent(documentId)}/plan`;
export const itemTypesPath = (documentId: string) =>
  `/documents/${encodeURIComponent(documentId)}/item-types`;

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

export async function readPlanState(api: ApiClient, documentId: string): Promise<PlanState> {
  const [{ items }, plan] = await Promise.all([
    api.json<ItemsResponse>(itemsPath(documentId)),
    api.json<PlanResponse>(planPath(documentId)),
  ]);
  return { items, plan };
}
