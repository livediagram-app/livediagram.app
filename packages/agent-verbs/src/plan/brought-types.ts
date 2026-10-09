// A board an agent makes brings its card types (docs/specs/026-plan/plan-agents.md "Adding a board",
// docs/specs/026-plan/item-types.md "The type catalogue"), as placing it in the editor does: in a document whose card
// types are not chosen and that has no cards, they become its card types; otherwise the ones it lacks join them.
// Nothing is read or written when no Plan board is among the elements, nor written when nothing changes. A refused
// save leaves the board as made, with nothing brought.
import type { ApiClient } from '@livediagram/api-client';
import type { DocumentResponse, ItemsResponse, ItemTypesRequest } from '@livediagram/api-schema';
import {
  boardTypeIdsOf,
  catalogueWithBoardTypes,
  typesOf,
  type ItemTypeCatalogue,
} from '@livediagram/items';
import { apiRefusalOf } from './api-refusal';
import { itemTypesPath } from './plan-state';
import { itemsPath } from '../verbs/shared';

type BoardLike = Parameters<typeof catalogueWithBoardTypes>[1][number];

// What the caller has just read: the document's stored catalogue (null: not chosen) and whether it has any card.
export interface KnownCardTypes {
  stored: ItemTypeCatalogue | null;
  hasCards: boolean;
  // Whether a Blank board was already there (it chose the default types, storing nothing): hasBlankBoard.
  hadBlank?: boolean;
}

async function readKnown(api: ApiClient, documentId: string): Promise<KnownCardTypes> {
  const [{ document }, { items }] = await Promise.all([
    api.json<DocumentResponse>(`/documents/${encodeURIComponent(documentId)}`),
    api.json<ItemsResponse>(itemsPath(documentId)),
  ]);
  return { stored: document.itemTypes ?? null, hasCards: items.length > 0 };
}

// Whether the catalogue saved; a refusal (no edit access) is false, anything else throws.
async function saved(
  api: ApiClient,
  documentId: string,
  next: ItemTypeCatalogue,
): Promise<boolean> {
  const body: ItemTypesRequest = { itemTypes: next };
  try {
    await api.json(itemTypesPath(documentId), { method: 'PUT', body: JSON.stringify(body) });
    return true;
  } catch (err) {
    if (!apiRefusalOf(err)) throw err;
    return false;
  }
}

// The ids of the types the document gained.
export async function bringBoardCardTypes(
  api: ApiClient,
  documentId: string,
  elements: readonly BoardLike[],
  known?: KnownCardTypes,
): Promise<string[]> {
  if (boardTypeIdsOf(elements).length === 0) return [];
  const { stored, hasCards, hadBlank = false } = known ?? (await readKnown(api, documentId));
  const next = catalogueWithBoardTypes(stored, elements, hasCards, hadBlank);
  const ok = next !== null && (await saved(api, documentId, next));
  return ok ? gained({ stored, hasCards, hadBlank }, next) : [];
}

// The ids the document gained. A fresh document's card types were chosen whole: every one is the board's.
function gained({ stored, hasCards, hadBlank }: KnownCardTypes, next: ItemTypeCatalogue): string[] {
  if (stored === null && !hasCards && !hadBlank) return next.types.map((t) => t.id);
  const had = new Set(typesOf(stored).map((t) => t.id));
  return next.types.filter((t) => !had.has(t.id)).map((t) => t.id);
}
