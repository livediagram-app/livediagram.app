// A closed account's name off the work they leave in other people's items (liveworkspace/docs/one-explorer-
// contracts.md "Closing an account"): the index anonymises its own rows and then tells each app which of its
// items name the person (internal.ts, POST /api/internal/people/:id/purge). The app's item Durable Object runs
// these over what it stores: comments, cards, assignments, changesets.
//
// `anonymiseJson` walks a parsed value: every string equal to one of the person's ids becomes ANONYMISED_PERSON, and
// an object that named them (by any key) loses the display copies a comment or a card keeps of them: its `*Name`
// keys read ANONYMISED_NAME, its `*Email` / `*Avatar` keys null (a plain `name` is the thing's own, kept).
// Anything else is left as it is.
//
// A person's ids are the account's and those of the guests merged into it (the door's `guests`, `closedPersonIds`):
// what they left as a guest is recorded under the guest's id, which the merge never rewrote (Work Tracker 1241).

import { ANONYMISED_PERSON } from '@liveworkspace/index-client';

// What a reference to a closed account becomes: the index's own word (@liveworkspace/index-client).
export { ANONYMISED_PERSON };

// Keys whose value is a display copy of a person, cleared in an object that named the closed account.
const PERSON_COPY = /^(?:[a-z]+)?(?:Name|Email|Avatar)$/;
// What a display name becomes.
export const ANONYMISED_NAME = 'Deleted account';

export type Anonymised<T> = { value: T; changed: boolean };

// The ids a closed account is anonymised under: its own, then each guest merged into it, once each.
export function closedPersonIds(personId: string, guestIds: readonly string[] = []): string[] {
  return [...new Set([personId, ...guestIds])];
}

// One id or several, as a set to look up.
const idSet = (ids: string | readonly string[]): ReadonlySet<string> =>
  new Set(typeof ids === 'string' ? [ids] : ids);

export function anonymiseJson<T>(value: T, personIds: string | readonly string[]): Anonymised<T> {
  const ids = idSet(personIds);
  let changed = false;
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (ids.has(node)) {
        changed = true;
        return ANONYMISED_PERSON;
      }
      return node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const source = node as Record<string, unknown>;
      const named = Object.values(source).some((v) => typeof v === 'string' && ids.has(v));
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(source)) {
        if (named && key !== 'name' && PERSON_COPY.test(key) && typeof child === 'string') {
          out[key] = key.endsWith('Name') ? ANONYMISED_NAME : null;
          changed = true;
        } else {
          out[key] = walk(child);
        }
      }
      return out;
    }
    return node;
  };
  const out = walk(value) as T;
  return { value: changed ? out : value, changed };
}

// Whether text mentions any of the ids: the cheap check before a parse.
const mentionsAny = (text: string, ids: string | readonly string[]): boolean =>
  typeof ids === 'string' ? text.includes(ids) : ids.some((id) => text.includes(id));

// The same over JSON text, cheap when the text never mentions them (no parse).
export function anonymiseJsonText(
  text: string,
  personIds: string | readonly string[],
): Anonymised<string> {
  if (!mentionsAny(text, personIds)) return { value: text, changed: false };
  try {
    const { value, changed } = anonymiseJson(JSON.parse(text) as unknown, personIds);
    return changed ? { value: JSON.stringify(value), changed } : { value: text, changed: false };
  } catch {
    return { value: text, changed: false };
  }
}

// Every comment reaction the person left, wherever a `reactions` list sits in the JSON text (a tab's canvas comments,
// a card thread's comments), named Deleted account: the room stamps each reaction's `person`, the reactor's hashed
// id (`reactionPersonFor` in @liveworkspace/api-kit/collab-key; each product's docs/specs/012-collaboration/
// comment-reactions.md). `reactionPersons` are the hashes of the person's ids (closedPersonIds). A reaction's `by`, a
// one-way collab key, stays. Cheap when the text never mentions them; one walk otherwise. A reaction from before
// reactions kept a person can't be found, and is left.
export function anonymiseReactionsText(
  text: string,
  reactionPersons: readonly string[],
): Anonymised<string> {
  if (!mentionsAny(text, reactionPersons)) return { value: text, changed: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { value: text, changed: false };
  }
  const persons = new Set(reactionPersons);
  let changed = false;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'reactions' && Array.isArray(v)) {
        out[k] = v.map((r: unknown) => {
          const person = (r as { person?: unknown } | null)?.person;
          if (typeof person !== 'string' || !persons.has(person)) return r;
          changed = true;
          return { ...(r as object), name: ANONYMISED_NAME, person: ANONYMISED_PERSON };
        });
      } else out[k] = walk(v);
    }
    return out;
  };
  const next = walk(parsed);
  return changed ? { value: JSON.stringify(next), changed } : { value: text, changed: false };
}

// The SQL that holds when `column` mentions any value of the JSON list bound at `param` (`instr`, never a bound LIKE:
// Durable Object SQLite refuses a LIKE pattern over 50 bytes). One bound parameter, whatever the number of ids.
export const mentionsAnySql = (column: string, param = '?'): string =>
  `EXISTS (SELECT 1 FROM json_each(${param}) WHERE instr(${column}, value) > 0)`;

// The SQL that holds when `column` equals any value of the JSON list bound at `param`.
export const isAnySql = (column: string, param = '?'): string =>
  `${column} IN (SELECT value FROM json_each(${param}))`;
