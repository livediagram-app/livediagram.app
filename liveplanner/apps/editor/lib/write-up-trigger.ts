// Write It Up's trigger (docs/specs/013-workspace/suggestions.md): a card this person moves to a done column with a
// decision in its description, or a Milestone card reaching done. The write path only notes which cards' status this
// person set (O(1) a write, at most WATCH_MAX kept); the idle check reads those few cards and their words.
import type { Item, ItemWrite } from '@liveplanner/items';

/** Cards whose status this person set lately, newest first, that a check still looks at. */
export const WATCH_MAX = 20;
/** The Milestone card type (brought-types.ts, Personal Goals): reached when it is in a done column. */
export const MILESTONE_TYPE = 'milestone';

let watched: string[] = [];
const listeners = new Set<() => void>();

function note(id: string): void {
  watched = [id, ...watched.filter((w) => w !== id)].slice(0, WATCH_MAX);
}

/** The person's own write (onOwnWrite): notes the cards it moves or whose status it sets. Undos are not news. */
export function noteStatusWrite(write: ItemWrite): void {
  let moved = false;
  if (write.kind === 'move' && !write.undo && write.move.status !== undefined) {
    note(write.id);
    moved = true;
  } else if (write.kind === 'moves' && !write.undo) {
    for (const m of write.moves.slice(0, WATCH_MAX)) {
      if (m.move.status !== undefined) {
        note(m.id);
        moved = true;
      }
    }
  } else if (write.kind === 'patch' && !write.undo && write.patch.set?.status !== undefined) {
    note(write.id);
    moved = true;
  }
  if (moved) for (const l of [...listeners]) l();
}

/** Hears a noted status write; answers the unsubscribe. */
export function onStatusWrite(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// A description's words, lower case, read left to right (letters only, no regular expression).
function wordsOf(text: string): string[] {
  const out: string[] = [];
  let word = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const lower = c.toLowerCase();
    if (lower !== c.toUpperCase() || c === '’' || c === "'") {
      if (c !== '’' && c !== "'") word += lower;
    } else if (word) {
      out.push(word);
      word = '';
    }
  }
  if (word) out.push(word);
  return out;
}

const DECISION_WORDS = new Set([
  'decided',
  'decide',
  'decision',
  'decisions',
  'agreed',
  'chose',
  'chosen',
  'resolved',
  'settled',
]);
// Two-word phrases that say a decision ("going with", "go with", "we will", "well go" for "we'll go").
const DECISION_PAIRS: readonly (readonly [string, string])[] = [
  ['going', 'with'],
  ['go', 'with'],
  ['we', 'will'],
  ['opted', 'for'],
];

/** Whether a description says a decision was made. Deterministic and linear in its length. */
export function hasDecision(text: string): boolean {
  const words = wordsOf(text);
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (DECISION_WORDS.has(w)) return true;
    const next = words[i + 1];
    if (next !== undefined && DECISION_PAIRS.some(([a, b]) => a === w && b === next)) return true;
  }
  return false;
}

export type WriteUpCard = { item: Item; milestone: boolean };

const description = (item: Item): string =>
  typeof item.fields.description === 'string' ? item.fields.description : '';

/**
 * The newest watched card now done with a decision in its description, or a Milestone now done; null when none. A
 * watched card no longer worth a look (gone, or not done) leaves the watch.
 */
export function doneWriteUpCard(
  items: ReadonlyMap<string, Item>,
  isDone: (status: string | undefined) => boolean,
  practice?: ReadonlySet<string>,
): WriteUpCard | null {
  const keep: string[] = [];
  let found: WriteUpCard | null = null;
  for (const id of watched) {
    const item = items.get(id);
    if (!item || practice?.has(id) || !isDone(item.fields.status as string | undefined)) continue;
    keep.push(id);
    if (found) continue;
    const milestone = item.type === MILESTONE_TYPE;
    if (milestone || hasDecision(description(item))) found = { item, milestone };
  }
  watched = keep;
  return found;
}

/** The card's description, as the page's body. */
export const writeUpCardBody = (item: Item): string => description(item).trim();

/** Forgets the watch, for tests. */
export function resetWriteUpWatchForTests(): void {
  watched = [];
  listeners.clear();
}
