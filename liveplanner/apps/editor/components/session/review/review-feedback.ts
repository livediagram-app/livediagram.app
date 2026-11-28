// Sprint Review's feedback (docs/specs/026-plan/session-tabs.md "Sprint Review", items.md "Review Feedback"): the
// thread later feedback joins, how much a card holds, and the session's summary of it. Pure.
import type { CardThread } from '@liveplanner/project';

// The title a card's first feedback thread is given.
export const FEEDBACK_THREAD_TITLE = 'Sprint Review feedback';

const isFeedbackThread = (t: Pick<CardThread, 'comments'>) => t.comments[0]?.label === 'review';

// The thread new feedback replies in: the newest open one on the card whose first comment is Review Feedback; else
// null (a new one starts).
export function feedbackThreadOf(threads: readonly CardThread[]): CardThread | null {
  let out: CardThread | null = null;
  for (const t of threads)
    if (!t.resolved && isFeedbackThread(t) && (!out || t.updatedAt > out.updatedAt)) out = t;
  return out;
}

// How many Review Feedback comments a card's threads hold.
export function feedbackCount(threads: readonly CardThread[]): number {
  let n = 0;
  for (const t of threads) for (const c of t.comments) if (c.label === 'review') n += 1;
  return n;
}

// Session Complete's feedback line over the queued cards: how many comments, on how many cards.
export function feedbackSummary(
  cardIds: readonly string[],
  threadsOf: (itemId: string) => readonly CardThread[],
): { comments: number; cards: number } {
  let comments = 0;
  let cards = 0;
  for (const id of cardIds) {
    const n = feedbackCount(threadsOf(id));
    comments += n;
    if (n) cards += 1;
  }
  return { comments, cards };
}

// "5 comments on 3 cards", "1 comment on 1 card", "None yet".
export function feedbackWords({ comments, cards }: { comments: number; cards: number }): string {
  if (!comments) return 'None yet';
  return `${comments} ${comments === 1 ? 'comment' : 'comments'} on ${cards} ${cards === 1 ? 'card' : 'cards'}`;
}
