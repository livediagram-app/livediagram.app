'use client';

// One card on a public roadmap (docs/specs/026-plan/public-roadmap.md "The allowlist"): its vote button with the
// count when voting is on, then its number, title, card type and labels, its description (three lines, Show More) and
// its dates, each only when the roadmap sends it. Nothing here knows any other field exists.
import { useId, useState } from 'react';
import type { PublicRoadmapCard } from '@liveplanner/api-schema';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideChevronUp } from '@liveworkspace/icons/lucide';
import { DAY_MONTH_YEAR } from '@liveworkspace/ui/date-format';

const ChevronUp = lucideGlyph(lucideChevronUp, 16);

// A card's day (`YYYY-MM-DD`) as the reader's calendar shows it: built as a local date, so no time zone moves it.
export function roadmapDay(day: string): string {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return DAY_MONTH_YEAR.format(new Date(y, m - 1, d));
}

// A description this long or with this many lines may run past three lines, so it gets Show More.
const LONG_DESCRIPTION = 180;

export function RoadmapCard({
  card,
  voting,
  pending,
  onVote,
}: {
  card: PublicRoadmapCard;
  voting: boolean;
  // A vote for this card is on its way: the button waits.
  pending: boolean;
  onVote: (up: boolean) => void;
}) {
  const descriptionId = useId();
  const [expanded, setExpanded] = useState(false);
  const long =
    !!card.description &&
    (card.description.length > LONG_DESCRIPTION || card.description.split('\n').length > 3);
  const chips = [...(card.type ? [card.type] : []), ...(card.labels ?? [])];
  const voted = card.voted === true;
  const votes = card.votes ?? 0;
  return (
    <li
      className="form-box form-ink flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900"
      data-roadmap-card=""
    >
      {voting ? (
        <button
          type="button"
          aria-pressed={voted}
          aria-label={`${voted ? 'Remove your vote for' : 'Vote for'} ${card.title}, ${votes} ${votes === 1 ? 'vote' : 'votes'}`}
          disabled={pending}
          onClick={() => onVote(!voted)}
          className={`flex h-14 w-11 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border text-[13px] font-semibold tabular-nums transition-colors disabled:cursor-wait disabled:opacity-70 ${
            voted
              ? 'border-transparent bg-[var(--form-accent)] text-[var(--form-on-accent)]'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-[var(--form-accent)] hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white'
          }`}
        >
          <ChevronUp />
          <span>{votes}</span>
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] dark:text-slate-50">
          {card.number !== undefined ? (
            <span className="mr-1.5 font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {card.ref ?? `#${card.number}`}
            </span>
          ) : null}
          {card.title}
        </h3>
        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-1" aria-label="Labels">
            {chips.map((chip, i) => (
              <li
                key={`${i}-${chip}`}
                className={`max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  i === 0 && card.type
                    ? 'bg-slate-900/[0.06] text-slate-700 dark:bg-white/10 dark:text-slate-200'
                    : 'bg-[color-mix(in_srgb,var(--form-accent)_14%,transparent)] text-slate-700 dark:text-slate-100'
                }`}
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        {card.description ? (
          <div>
            <p
              id={descriptionId}
              className={`whitespace-pre-line text-[13px] leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300 ${
                expanded ? '' : 'line-clamp-3'
              }`}
            >
              {card.description}
            </p>
            {long ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={descriptionId}
                onClick={() => setExpanded((e) => !e)}
                className="mt-0.5 cursor-pointer text-[12px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
              >
                {expanded ? 'Show Less' : 'Show More'}
              </button>
            ) : null}
          </div>
        ) : null}
        {card.start || card.due ? (
          <p className="flex flex-wrap gap-x-3 text-[12px] text-slate-500 dark:text-slate-400">
            {card.start ? <span>Starts {roadmapDay(card.start)}</span> : null}
            {card.due ? <span>Target {roadmapDay(card.due)}</span> : null}
          </p>
        ) : null}
      </div>
    </li>
  );
}
