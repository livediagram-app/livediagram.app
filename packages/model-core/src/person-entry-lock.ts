// Whole-tab writes keep other people's entries (each product's docs/specs/013-workspace/share-roles.md, "Whole-tab
// writes keep other people's entries"). A tab save, an agent's changeset or a re-commit replaces a tab whole, so
// without this it could add, change or take away anyone's comment reaction, response or dot. The rule, for every
// per-person entry: the writer's own is what it wrote; anyone else's is the room ledger's latest on or off for that
// person when the ledger has one, and otherwise what the stored tab held. The stored tab alone can't tell another
// person's live entry (in the ledger, not saved yet) from one the writer made up, so both are read.
//
// Pure and shared: each product walks its own tab and hands this the entries of one comment, one card or one vote.
// The writer's key is their server-derived collab key, or null for a writer that may change nobody's (an agent).

import type { CommentReaction } from './comment-reactions';

/** What the ledger last recorded for one person's slot: on, with the entry, or off. */
export type LedgerWord<V> = { on: true; value: V } | { on: false };

/** How a list of per-person entries is keyed: the slot each fills (one entry per slot) and whose it is. */
export type EntryKeys<V> = {
  slotOf(entry: V): string;
  personOf(entry: V): string;
  same(a: V, b: V): boolean;
};

/** One person's entry after a whole-tab write. */
export function lockedEntry<V>(
  written: V | undefined,
  stored: V | undefined,
  ledger: LedgerWord<V> | undefined,
  own: boolean,
): V | undefined {
  if (own) return written;
  if (ledger) return ledger.on ? ledger.value : undefined;
  return stored;
}

function bySlot<V>(entries: readonly V[] | undefined, keys: EntryKeys<V>): Map<string, V> {
  const out = new Map<string, V>();
  for (const entry of entries ?? [])
    if (!out.has(keys.slotOf(entry))) out.set(keys.slotOf(entry), entry);
  return out;
}

/** Whether a write changes, adds or takes away anyone's entry but the writer's, against the stored list. */
export function foreignEntriesDiffer<V>(
  written: readonly V[] | undefined,
  stored: readonly V[] | undefined,
  keys: EntryKeys<V>,
  writerKey: string | null,
): boolean {
  // The common case, a save that leaves the list as stored: one pass, nothing allocated.
  if (
    written?.length === stored?.length &&
    (written ?? []).every((e, i) => keys.same(e, stored![i]!))
  )
    return false;
  const kept = bySlot(stored, keys);
  let foreign = 0;
  for (const entry of written ?? []) {
    if (keys.personOf(entry) === writerKey) continue;
    const was = kept.get(keys.slotOf(entry));
    if (!was || !keys.same(was, entry)) return true;
    foreign += 1;
  }
  let storedForeign = 0;
  for (const entry of kept.values()) if (keys.personOf(entry) !== writerKey) storedForeign += 1;
  return foreign !== storedForeign;
}

/**
 * A list of per-person entries after a whole-tab write: in the written order, the writer's as written and everyone
 * else's as `lockedEntry` has them, then anyone else's the stored list or the ledger keeps that the write left out.
 * The SAME list (or undefined) when nothing changes.
 */
export function lockEntries<V>(
  written: readonly V[] | undefined,
  stored: readonly V[] | undefined,
  ledger: ReadonlyMap<string, LedgerWord<V>>,
  keys: EntryKeys<V>,
  writerKey: string | null,
): V[] | undefined {
  const kept = bySlot(stored, keys);
  const placed = new Set<string>();
  const out: V[] = [];
  let changed = false;
  const take = (slot: string, entry: V | undefined, was: V | undefined) => {
    placed.add(slot);
    if (entry !== undefined) out.push(entry);
    if (entry !== was) changed = true;
  };
  for (const entry of written ?? []) {
    const slot = keys.slotOf(entry);
    if (placed.has(slot)) {
      changed = true;
      continue;
    }
    const own = keys.personOf(entry) === writerKey;
    const next = lockedEntry(entry, kept.get(slot), ledger.get(slot), own);
    take(slot, next !== undefined && keys.same(next, entry) ? entry : next, entry);
  }
  const rest = (slot: string, person: string, stays: V | undefined) => {
    if (placed.has(slot) || person === writerKey) return;
    take(slot, stays, undefined);
  };
  for (const [slot, entry] of kept)
    rest(slot, keys.personOf(entry), lockedEntry(undefined, entry, ledger.get(slot), false));
  for (const [slot, word] of ledger) if (word.on) rest(slot, keys.personOf(word.value), word.value);
  if (!changed) return written as V[] | undefined;
  return out.length ? out : undefined;
}

// --- Comment reactions ----------------------------------------------------------------------------------------------

/** A reaction's slot: one per person per emoji. */
export const REACTION_KEYS: EntryKeys<CommentReaction> = {
  slotOf: (r) => `${r.emoji}\u0000${r.by}`,
  personOf: (r) => r.by,
  same: (a, b) =>
    a.emoji === b.emoji && a.by === b.by && a.name === b.name && a.person === b.person,
};

/** A ledger's reaction record, as every product's collab-ledger keeps it: keyed `${commentId}\0${emoji}\0${by}`. */
export type LedgerReacts = Record<string, { on: boolean; name: string; person?: string }>;

/** The ledger's word on each reaction slot of one comment. */
export function reactionWords(
  reacts: LedgerReacts | undefined,
  commentId: string,
): Map<string, LedgerWord<CommentReaction>> {
  const out = new Map<string, LedgerWord<CommentReaction>>();
  const prefix = `${commentId}\u0000`;
  for (const [key, r] of Object.entries(reacts ?? {})) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const cut = rest.indexOf('\u0000');
    if (cut <= 0) continue;
    const emoji = rest.slice(0, cut) as CommentReaction['emoji'];
    const by = rest.slice(cut + 1);
    const value: CommentReaction = {
      emoji,
      by,
      name: r.name,
      ...(r.person !== undefined ? { person: r.person } : {}),
    };
    out.set(REACTION_KEYS.slotOf(value), r.on ? { on: true, value } : { on: false });
  }
  return out;
}

/**
 * A comment's reactions with the duplicates an editor from before the collab key left collapsed: a reaction whose
 * key is not a derived one (`isDerivedKey`) goes when the comment holds the same emoji, under the same name, from a
 * derived key. The SAME list when there is nothing to collapse.
 */
export function collapseLegacyReactions(
  reactions: CommentReaction[] | undefined,
  isDerivedKey: (key: string) => boolean,
): CommentReaction[] | undefined {
  if (!reactions || reactions.length < 2) return reactions;
  if (reactions.every((r) => isDerivedKey(r.by))) return reactions;
  const derived = new Set<string>();
  for (const r of reactions) if (isDerivedKey(r.by)) derived.add(`${r.emoji}\u0000${r.name}`);
  if (derived.size === 0) return reactions;
  const kept = reactions.filter(
    (r) => isDerivedKey(r.by) || !derived.has(`${r.emoji}\u0000${r.name}`),
  );
  return kept.length === reactions.length ? reactions : kept;
}

// --- Responses (one per person on a card: done checks, estimates, temperature checks, quiz answers) ------------------

export type PersonResponse = { participantId: string; value: string; at: number };

export const RESPONSE_KEYS: EntryKeys<PersonResponse> = {
  slotOf: (r) => r.participantId,
  personOf: (r) => r.participantId,
  same: (a, b) => a.participantId === b.participantId && a.value === b.value && a.at === b.at,
};

/** A ledger's responses record, as livediagram's and liveplanner's collab-ledger keep it: a withdraw is null. */
export type LedgerResponses = Record<string, { value: string | null; at: number }>;

export function responseWords(
  responses: LedgerResponses | undefined,
): Map<string, LedgerWord<PersonResponse>> {
  const out = new Map<string, LedgerWord<PersonResponse>>();
  for (const [participantId, r] of Object.entries(responses ?? {})) {
    out.set(
      participantId,
      r.value === null
        ? { on: false }
        : { on: true, value: { participantId, value: r.value, at: r.at } },
    );
  }
  return out;
}

// --- A vote's dots (one entry per dot, so a person may stack several on one element) ---------------------------------

type Dots = Readonly<Record<string, readonly string[]>>;

function foreignCounts(
  ids: readonly string[] | undefined,
  writerKey: string | null,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of ids ?? []) if (id !== writerKey) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

function sameCounts(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, n] of a) if (b.get(id) !== n) return false;
  return true;
}

/** Whether a write's dots differ from the stored round's on anyone's but the writer's. */
export function foreignDotsDiffer(
  written: Dots,
  stored: Dots | undefined,
  writerKey: string | null,
): boolean {
  const ids = new Set([...Object.keys(written), ...Object.keys(stored ?? {})]);
  for (const id of ids) {
    if (!sameCounts(foreignCounts(written[id], writerKey), foreignCounts(stored?.[id], writerKey)))
      return true;
  }
  return false;
}

/**
 * A round's dots after a whole-tab write: the writer's as written, everyone else's as the ledger's round map has
 * them when it has the round (it holds every dot of it), else as the stored round had them, else none. An element's
 * list keeps the written order when its other people's dots already match. The SAME map when nothing changes.
 */
export function lockDots(
  written: Dots,
  stored: Dots | undefined,
  ledger: Dots | undefined,
  writerKey: string | null,
): Record<string, string[]> {
  const source = ledger ?? stored ?? {};
  const out: Record<string, string[]> = {};
  let changed = false;
  for (const id of new Set([...Object.keys(written), ...Object.keys(source)])) {
    const mine = written[id] ?? [];
    if (sameCounts(foreignCounts(mine, writerKey), foreignCounts(source[id], writerKey))) {
      if (written[id]) out[id] = [...mine];
      continue;
    }
    changed = true;
    const others = (source[id] ?? []).filter((voter) => voter !== writerKey);
    out[id] = [...others, ...mine.filter((voter) => voter === writerKey)];
  }
  return changed ? out : (written as Record<string, string[]>);
}
