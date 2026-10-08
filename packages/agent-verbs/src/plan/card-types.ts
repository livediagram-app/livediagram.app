// Changing card types (docs/specs/026-plan/plan-agents.md "Changing card types"): the catalogue read with the plan,
// every change applied and checked whole (applyCardTypeChanges), saved once, then the cards of any deleted type
// moved to the Trash, as the type editor's Delete Type does. A refusal before the save saves nothing.
import type { ApiClient } from '@livediagram/api-client';
import type { ItemResponse, ItemTypesRequest } from '@livediagram/api-schema';
import {
  applyCardTypeChanges,
  isTrashed,
  itemStatus,
  ITEM_TYPE_CATALOGUE_VERSION,
  TRASH_STATUS,
  TRASHED_FROM_FIELD,
  typesOf,
  type CardTypeChange,
} from '@livediagram/items';
import { apiRefusalOf } from './api-refusal';
import { listedType, type ListedType } from './plan-listing';
import { itemsPath } from '../verbs/shared';
import { itemTypesPath, readPlanState } from './plan-state';

export interface CardTypeChangesResult {
  applied: string[];
  // The numbers of the cards moved to the Trash with a deleted type.
  trashed: string[];
  types: ListedType[];
  refusal?: { code: string; message: string };
}

export async function changeCardTypes(
  api: ApiClient,
  documentId: string,
  changes: readonly CardTypeChange[],
): Promise<CardTypeChangesResult> {
  const state = await readPlanState(api, documentId);
  const stored = { version: ITEM_TYPE_CATALOGUE_VERSION, types: state.plan.types };
  const result = applyCardTypeChanges(stored, changes, state.plan.statuses);
  if (!result.ok)
    return {
      applied: [],
      trashed: [],
      types: state.plan.types.map(listedType),
      refusal: {
        code: result.code,
        message: `${result.message}${result.applied.length ? ` Nothing was saved (it would have applied: ${result.applied.join('; ')}).` : ''}`,
      },
    };
  const body: ItemTypesRequest = { itemTypes: result.catalogue };
  try {
    await api.json(itemTypesPath(documentId), { method: 'PUT', body: JSON.stringify(body) });
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { applied: [], trashed: [], types: state.plan.types.map(listedType), refusal };
  }
  const types = typesOf(result.catalogue).map(listedType);
  const gone = new Set(result.deleted);
  const trashed: string[] = [];
  try {
    for (const item of state.items) {
      if (!gone.has(item.type) || isTrashed(item)) continue;
      const from = itemStatus(item);
      await api.json<ItemResponse>(`${itemsPath(documentId)}/${encodeURIComponent(item.id)}`, {
        method: 'POST',
        body: JSON.stringify({
          set: { status: TRASH_STATUS, ...(from ? { [TRASHED_FROM_FIELD]: from } : {}) },
        }),
      });
      trashed.push(`#${item.key}`);
    }
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { applied: result.applied, trashed, types, refusal };
  }
  return { applied: result.applied, trashed, types };
}
