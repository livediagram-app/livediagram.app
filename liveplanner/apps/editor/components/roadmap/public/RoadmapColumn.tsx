'use client';

// One chosen column on a public roadmap (docs/specs/026-plan/public-roadmap.md "What a visitor sees"): its name and
// card count, then its cards in the board's order, or "Nothing here yet." The count is the column's whole number, so
// it can read more than the 200 cards drawn.
import { useId } from 'react';
import type { PublicRoadmapColumn } from '@liveplanner/api-schema';
import { Chip } from '@liveplanner/ui';
import { RoadmapCard } from './RoadmapCard';

export function RoadmapColumn({
  column,
  voting,
  pending,
  onVote,
}: {
  column: PublicRoadmapColumn;
  voting: boolean;
  pending: ReadonlySet<string>;
  onVote: (cardId: string, up: boolean) => void;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 rounded-2xl bg-white/55 p-3 ring-1 ring-slate-900/[0.06] backdrop-blur-sm sm:w-[320px] sm:shrink-0 dark:bg-slate-900/55 dark:ring-white/[0.08]"
      data-roadmap-column=""
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h2
          id={headingId}
          className="truncate text-[13px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200"
        >
          {column.name}
        </h2>
        <Chip className="bg-slate-900/[0.06] px-2 py-0.5 text-[12px] font-medium tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
          <span aria-hidden>{column.count}</span>
          <span className="sr-only">
            {column.count} {column.count === 1 ? 'card' : 'cards'}
          </span>
        </Chip>
      </header>
      {column.cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nothing here yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {column.cards.map((card) => (
            <RoadmapCard
              key={card.id}
              card={card}
              voting={voting}
              pending={pending.has(card.id)}
              onVote={(up) => onVote(card.id, up)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
