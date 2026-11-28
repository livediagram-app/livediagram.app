'use client';

// Sprint Review's lines on Session Complete (docs/specs/026-plan/session-tabs.md "Sprint Review"): the Review Feedback
// the queued cards hold ("5 comments on 3 cards"), and each follow-up made in the session, its number and title and
// the card it came from; pressing one opens it.
import { itemTitle, type Item, type ItemTypeDef } from '@liveplanner/items';
import { refOf } from '../session-words';
import { feedbackWords } from './review-feedback';

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function ReviewSummary({
  feedback,
  followUps,
  items,
  types,
  onOpen,
}: {
  feedback: { comments: number; cards: number };
  // Each reviewed card's id beside the follow-ups made from it, in the queue's order.
  followUps: readonly { from: string; ids: readonly string[] }[];
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  onOpen: (itemId: string) => void;
}) {
  const made = followUps.flatMap(({ from, ids }) =>
    ids.flatMap((id) => {
      const card = items.get(id);
      return card ? [{ from, card }] : [];
    }),
  );
  return (
    <div className="flex w-full max-w-md flex-col gap-4 text-left" data-review-summary="">
      <section className="flex flex-col gap-1">
        <h3 className={HEADING}>Feedback</h3>
        <p className="text-[14px] text-slate-800 dark:text-slate-100" data-review-feedback="">
          {feedbackWords(feedback)}
        </p>
      </section>
      <section className="flex flex-col gap-1.5">
        <h3 className={HEADING}>Follow-ups</h3>
        {made.length ? (
          <ul className="flex flex-col gap-1">
            {made.map(({ from, card }) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => onOpen(card.id)}
                  data-review-follow-up={card.id}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <span className="shrink-0 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                    {refOf(card.id, items, types)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                    {itemTitle(card)}
                  </span>
                  <span className="shrink-0 text-[12px] text-slate-500 dark:text-slate-400">
                    from {refOf(from, items, types)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-slate-500 dark:text-slate-400">None made</p>
        )}
      </section>
    </div>
  );
}
