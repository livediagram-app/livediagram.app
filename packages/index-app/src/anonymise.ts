// A closed account's name off the work they leave in other people's items (liveworkspace/docs/one-explorer-
// contracts.md "Closing an account"): the index anonymises its own rows and then tells each app which of its
// items name the person (internal.ts, POST /api/internal/people/:id/purge). The app's item Durable Object runs
// these over what it stores: comments, cards, assignments, changesets.
//
// `anonymiseJson` walks a parsed value: every string equal to the person's id becomes ANONYMISED_PERSON, and an
// object that named them (by any key) loses the display copies a comment or a card keeps of them: its `*Name`
// keys read ANONYMISED_NAME, its `*Email` / `*Avatar` keys null (a plain `name` is the thing's own, kept).
// Anything else is left as it is.

// What a reference to a closed account becomes: the index's own word, shaped like neither an account (`user_…`)
// nor a guest (`guest_…`), so it can never match anyone.
export const ANONYMISED_PERSON = 'deleted';

// Keys whose value is a display copy of a person, cleared in an object that named the closed account.
const PERSON_COPY = /^(?:[a-z]+)?(?:Name|Email|Avatar)$/;
// What a display name becomes.
export const ANONYMISED_NAME = 'Deleted account';

export type Anonymised<T> = { value: T; changed: boolean };

export function anonymiseJson<T>(value: T, personId: string): Anonymised<T> {
  let changed = false;
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (node === personId) {
        changed = true;
        return ANONYMISED_PERSON;
      }
      return node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const source = node as Record<string, unknown>;
      const named = Object.values(source).some((v) => v === personId);
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

// The same over JSON text, cheap when the text never mentions them (no parse).
export function anonymiseJsonText(text: string, personId: string): Anonymised<string> {
  if (!text.includes(personId)) return { value: text, changed: false };
  try {
    const { value, changed } = anonymiseJson(JSON.parse(text) as unknown, personId);
    return changed ? { value: JSON.stringify(value), changed } : { value: text, changed: false };
  } catch {
    return { value: text, changed: false };
  }
}
