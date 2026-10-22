// A board an agent makes brings its card types (docs/specs/026-plan/plan-agents.md "Adding a board",
// docs/specs/026-plan/item-types.md "The type catalogue"), as placing it in the editor does: the ones the project
// lacks join its card types (in a fresh project, they become them).
// Nothing is read or written when no Plan board is among the elements, nor written when nothing changes. A refused
// save leaves the board as made, with nothing brought. The save names the catalogue's revision it read; when another
// change landed first, the card types are read again and brought to them (CARD_TYPES_SAVE_ATTEMPTS).
import type { ApiClient } from '@liveplanner/api-client';
import type { ProjectResponse, ItemTypesRequest } from '@liveplanner/api-schema';
import {
  boardTypeIdsOf,
  catalogueWithBoardTypes,
  typesOf,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import { apiRefusalOf } from './api-refusal';
import { CARD_TYPES_SAVE_ATTEMPTS, isCardTypesStale, itemTypesPath } from './plan-state';

type BoardLike = Parameters<typeof catalogueWithBoardTypes>[1][number];

// What the caller has just read: the project's stored catalogue (null: not chosen).
interface KnownCardTypes {
  stored: ItemTypeCatalogue | null;
  // The catalogue's revision as read (the project's `itemTypesRev`); absent saves whatever is stored.
  rev?: number;
}

async function readKnown(api: ApiClient, projectId: string): Promise<KnownCardTypes> {
  const { project } = await api.json<ProjectResponse>(
    `/projects/${encodeURIComponent(projectId)}`,
  );
  return {
    stored: project.itemTypes ?? null,
    ...(project.itemTypesRev !== undefined ? { rev: project.itemTypesRev } : {}),
  };
}

// Whether the catalogue saved: 'stale' when another change landed since `rev`, false for a refusal (no edit
// access); anything else throws.
async function saved(
  api: ApiClient,
  projectId: string,
  next: ItemTypeCatalogue,
  rev: number | undefined,
): Promise<boolean | 'stale'> {
  const body: ItemTypesRequest = {
    itemTypes: next,
    ...(rev !== undefined ? { expectedRev: rev } : {}),
  };
  try {
    await api.json(itemTypesPath(projectId), { method: 'PUT', body: JSON.stringify(body) });
    return true;
  } catch (err) {
    if (isCardTypesStale(err)) return 'stale';
    if (!apiRefusalOf(err)) throw err;
    return false;
  }
}

// The ids of the types the project gained.
export async function bringBoardCardTypes(
  api: ApiClient,
  projectId: string,
  elements: readonly BoardLike[],
  known?: KnownCardTypes,
): Promise<string[]> {
  if (boardTypeIdsOf(elements).length === 0) return [];
  let read = known ?? (await readKnown(api, projectId));
  for (let attempt = 1; ; attempt += 1) {
    const { stored, rev } = read;
    const next = catalogueWithBoardTypes(stored, elements);
    if (next === null) return [];
    const ok = await saved(api, projectId, next, rev);
    if (ok === true) return gained(stored, next);
    if (ok === false || attempt >= CARD_TYPES_SAVE_ATTEMPTS) return [];
    read = await readKnown(api, projectId);
  }
}

// The ids the project gained.
function gained(stored: ItemTypeCatalogue | null, next: ItemTypeCatalogue): string[] {
  const had = new Set(typesOf(stored).map((t) => t.id));
  return next.types.filter((t) => !had.has(t.id)).map((t) => t.id);
}
