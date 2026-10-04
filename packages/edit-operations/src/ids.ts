// New elements' ids (docs/specs/024-agents/blueprints/edit-operations.md "Ids", EO8, EO9): an `id=` must
// be a slug id that is neither a keyword nor taken; without one, the id is a slug of the label, or of
// the kind word for an unlabelled element (`arrow`, `arrow-2`), free among every id of the tab and
// every id minted earlier in the changeset.

import type { EditRejection } from '@livediagram/api-schema';
import { SLUG_ID_MAX_LENGTH, isSlugId, slugIdFor } from '@livediagram/document';
import { idTaken, invalidValue } from './rejections';
import type { EditState } from './state';
import { RESERVED_WORDS } from './vocabulary';

// Every id an element of the tab holds or the changeset used, and every keyword.
function takenIds(state: EditState): Set<string> {
  return new Set([
    ...state.before.keys(),
    ...state.byId.keys(),
    ...state.removed.keys(),
    ...RESERVED_WORDS,
  ]);
}

export function newElementId(
  state: EditState,
  { given, label, kind }: { given?: string; label?: string; kind: string },
  operation: number,
): string | EditRejection {
  const taken = takenIds(state);
  if (given === undefined) return slugIdFor(label ?? '', kind, taken);
  if (!isSlugId(given) || RESERVED_WORDS.has(given))
    return invalidValue(
      operation,
      'id',
      given,
      `a slug id: lower case letters, digits, - and _, starting with a letter, at most ${SLUG_ID_MAX_LENGTH} characters, not a keyword`,
    );
  if (!taken.has(given)) return given;
  const holder = state.byId.get(given) ?? state.before.get(given);
  return holder
    ? idTaken(operation, holder, taken)
    : invalidValue(operation, 'id', given, 'used by an element this changeset removed');
}
