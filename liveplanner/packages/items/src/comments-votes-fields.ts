// A type's Comments and Votes fields (docs/specs/026-plan/item-types.md "Comments and Votes fields"): the built-in
// Comments or Votes and the type's own of that kind, in the order the type lists them. A thread names its Comments
// field (none: the built-in Comments); a Votes field holds `{ voter: dots }` under its id. Pure.
import type { ItemTypeDef } from './item-types';

export const COMMENTS_FIELD = 'comments';
export const VOTES_FIELD = 'votes';

function fieldsOfKind(
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
  kind: 'comments' | 'votes',
): string[] {
  const own = new Set((type.custom ?? []).filter((c) => c.kind === kind).map((c) => c.id));
  return type.fields.filter((f) => f === kind || own.has(f));
}

/** The type's Comments fields, built-in and its own, in its order. */
export const commentsFieldsOf = (type: Pick<ItemTypeDef, 'fields' | 'custom'>): string[] =>
  fieldsOfKind(type, 'comments');

/** The type's Votes fields, built-in and its own, in its order. */
export const votesFieldsOf = (type: Pick<ItemTypeDef, 'fields' | 'custom'>): string[] =>
  fieldsOfKind(type, 'votes');

/** The Votes field a session vote's tally lands in on a card of `type`: the vote's field while the type offers it,
 *  else the built-in Votes (docs/specs/012-collaboration/session-tools.md "Count In"). */
export const tallyFieldOn = (
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
  field: string | undefined,
): string => (field && votesFieldsOf(type).includes(field) ? field : VOTES_FIELD);

/** The Votes fields a vote on a tab of `types` can count in: the built-in first (the default, where every card
 *  without the picked field takes its dots), then each type's own, deduped, in the order the types list them (the
 *  Vote set-up's Count In, shown when there is more than one). */
export function votesFieldsAcross(
  types: readonly Pick<ItemTypeDef, 'fields' | 'custom'>[],
): string[] {
  const out = new Set<string>([VOTES_FIELD]);
  for (const t of types) for (const f of votesFieldsOf(t)) out.add(f);
  return [...out];
}

/** The Comments field a thread shows under on a card of `type`: its own field while the type offers it, else the
 *  type's first Comments field (the built-in when it has it), or null when the type has none. */
export function threadFieldOn(
  thread: { field?: string | undefined },
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
): string | null {
  const fields = commentsFieldsOf(type);
  const own = thread.field ?? COMMENTS_FIELD;
  if (fields.includes(own)) return own;
  return fields.includes(COMMENTS_FIELD) ? COMMENTS_FIELD : (fields[0] ?? null);
}

/** The threads one Comments field of a card of `type` lists. */
export function threadsInField<T extends { field?: string | undefined }>(
  threads: readonly T[],
  type: Pick<ItemTypeDef, 'fields' | 'custom'>,
  field: string,
): T[] {
  return threads.filter((t) => threadFieldOn(t, type) === field);
}

/** The field a new thread is started in, as stored: absent for the built-in Comments. */
export const storedThreadField = (field: string | undefined): { field?: string } =>
  field && field !== COMMENTS_FIELD ? { field } : {};
