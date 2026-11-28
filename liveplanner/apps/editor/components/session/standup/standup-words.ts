// Stand-up's words (docs/specs/026-plan/session-tabs.md "Stand-up"): the Blocked dialog's reason chips, the day's
// stand-up thread and its comments, a person's name and the action bar's person line. Pure.
import type { CardThread } from '@liveplanner/project';
import type { ItemPerson } from '@liveplanner/items';
import type { StripWords } from '../review/FeedbackStrip';

// The reasons Blocked offers as chips; any other words may be typed.
export const BLOCKED_CHIPS = [
  'Waiting on Someone',
  'Waiting on Review',
  'Needs a Decision',
  'External Dependency',
  'Unclear Requirements',
] as const;

// What the cards with no assignee are called.
export const UNASSIGNED_NAME = 'Unassigned';

export const personName = (person: Pick<ItemPerson, 'name'> | null): string =>
  person ? person.name || 'Someone' : UNASSIGNED_NAME;

// The day's stand-up thread's title: "Stand-up, 28 Nov".
export const standupThreadTitle = (now: number): string =>
  `Stand-up, ${new Date(now).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

// The thread a stand-up comment joins: the newest open one on the card titled for today; else null (a new one starts).
export function standupThreadOf(threads: readonly CardThread[], title: string): CardThread | null {
  let out: CardThread | null = null;
  for (const t of threads)
    if (!t.resolved && t.title === title && (!out || t.updatedAt > out.updatedAt)) out = t;
  return out;
}

// A Blocked reason as the card's comment says it.
export const blockedComment = (reason: string) => `Blocked: ${reason}`;

// The action bar's line: "Ana Diaz · card 1 of 3", and the card's Blocked reason when it was marked in this session.
export function personLine(name: string, place: number, count: number, reason?: string): string {
  const where = `${name} · card ${place} of ${count}`;
  return reason ? `${where} · Blocked: ${reason}` : where;
}

// The comment strip's words.
export const COMMENT_WORDS: StripWords = {
  heading: 'Comment',
  placeholder: 'Add a note to {ref}',
  name: 'Comment on',
  add: 'Add Comment',
  addShort: 'Add',
};
