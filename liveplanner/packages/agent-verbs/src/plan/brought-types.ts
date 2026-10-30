// A board an agent makes brings its card types (docs/specs/026-plan/plan-agents.md "Adding a board",
// docs/specs/026-plan/item-types.md "The type catalogue"), as placing it in the editor does: the ones the project
// lacks join its card types (in a fresh project, they become them). Its statuses join the types it takes, and no
// others (item-types.md "The statuses a type uses"), as does a column or a type change_board gives a board
// (joinBoardStatuses); given the statuses the boards named before, types stored before the list are first written
// in the new shape.
// Nothing is read or written when no Plan board or chart is among the elements, nor written when nothing changes. A
// refused save leaves the board as made, with nothing brought. The save names the catalogue's revision it read; when
// another change landed first, the card types are read again and the change made to them (CARD_TYPES_SAVE_ATTEMPTS).
import type { ApiClient } from '@liveworkspace/api-client';
import type { ProjectResponse, ItemTypesRequest } from '@liveplanner/api-schema';
import {
  boardStatusJoins,
  boardTypeIdsOf,
  catalogueWithBoardTypes,
  typesOf,
  withTypeStatuses,
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
  const { project } = await api.json<ProjectResponse>(`/projects/${encodeURIComponent(projectId)}`);
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

// Saves `make` of the stored catalogue, made again to it when another change landed first; the catalogue it left,
// with what it was made from, or null when nothing changed or it did not save.
async function savedChange(
  api: ApiClient,
  projectId: string,
  make: (stored: ItemTypeCatalogue | null) => ItemTypeCatalogue | null,
  known?: KnownCardTypes,
): Promise<{ stored: ItemTypeCatalogue | null; next: ItemTypeCatalogue } | null> {
  let read = known ?? (await readKnown(api, projectId));
  for (let attempt = 1; ; attempt += 1) {
    const { stored, rev } = read;
    const next = make(stored);
    if (next === null) return null;
    const ok = await saved(api, projectId, next, rev);
    if (ok === true) return { stored, next };
    if (ok === false || attempt >= CARD_TYPES_SAVE_ATTEMPTS) return null;
    read = await readKnown(api, projectId);
  }
}

const planBoardsOf = (elements: readonly BoardLike[]) =>
  elements.flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-board' ? [el.planBoard] : [],
  );

// The catalogue once `before` boards became `after`: each type gains, at the end of its list, the statuses `after`
// gives it that `before` did not; with `planStatuses`, a legacy type is first written as every one of them less what
// it left out. Null when nothing changes.
function joined(
  catalogue: ItemTypeCatalogue | null,
  before: readonly unknown[],
  after: readonly unknown[],
  planStatuses: readonly string[] | undefined,
): ItemTypeCatalogue | null {
  const ids = typesOf(catalogue).map((t) => t.id);
  const joins = boardStatusJoins(before, after, ids);
  return withTypeStatuses(catalogue, { joins, ...(planStatuses ? { planStatuses } : {}) });
}

// The ids of the types the project gained. `planStatuses`: every status the boards named before these were made.
export async function bringBoardCardTypes(
  api: ApiClient,
  projectId: string,
  elements: readonly BoardLike[],
  known?: KnownCardTypes,
  planStatuses?: readonly string[],
): Promise<string[]> {
  const boards = planBoardsOf(elements);
  if (boardTypeIdsOf(elements).length === 0 && boards.length === 0) return [];
  const done = await savedChange(
    api,
    projectId,
    (stored) => {
      const brought = catalogueWithBoardTypes(stored, elements);
      return joined(brought ?? stored, [], boards, planStatuses) ?? brought;
    },
    known,
  );
  return done ? gained(done.stored, done.next) : [];
}

// A board's statuses join the types it takes once change_board has changed it (`before` to `after`, set-ups):
// whether anything was saved. `planStatuses`: every status the boards named before the change. The board is changed
// already, so a refusal (the card types unreadable or not this caller's to change) leaves it so and answers false.
export async function joinBoardStatuses(
  api: ApiClient,
  projectId: string,
  before: unknown,
  after: unknown,
  planStatuses: readonly string[],
): Promise<boolean> {
  try {
    const done = await savedChange(api, projectId, (stored) =>
      joined(stored, [before], [after], planStatuses),
    );
    return done !== null;
  } catch (err) {
    if (!apiRefusalOf(err)) throw err;
    return false;
  }
}

// The ids the project gained.
function gained(stored: ItemTypeCatalogue | null, next: ItemTypeCatalogue): string[] {
  const had = new Set(typesOf(stored).map((t) => t.id));
  return next.types.filter((t) => !had.has(t.id)).map((t) => t.id);
}
