'use client';

// An Arcade Machine's High Scores (docs/specs/009-elements/social-pieces.md "High Scores"): its ten best, best first,
// each its rank, the player's name (and You for your own), the score and the day it was set. The row a run just
// posted is lit. Read from the machine's element, so a score posted on another screen appears as it lands.

import { useId } from 'react';
import { lucideTrophy } from '@liveworkspace/icons/lucide';
import { CompactEmptyState, lucideGlyph } from '@livehuddle/ui';
import type { ArcadeScore } from '@livehuddle/document';

const TrophyIcon = lucideGlyph(lucideTrophy, 18);
const SCORE = new Intl.NumberFormat('en-GB');
// "5 Nov", in the reader's own time zone.
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export function HighScores({
  scores,
  myKey,
  litId,
  note,
}: {
  scores: readonly ArcadeScore[] | undefined;
  // Your signing key: your rows say You.
  myKey: string | null;
  // The row your last run posted.
  litId: string | null;
  // A line under the table (a Viewer's "Viewers See the Scores").
  note?: string;
}) {
  const titleId = useId();
  const rows = scores ?? [];
  return (
    <section className="px-3 pb-3 pt-1" aria-labelledby={titleId}>
      <h3
        id={titleId}
        className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        High Scores
      </h3>
      {rows.length === 0 ? (
        <CompactEmptyState size="small" icon={<TrophyIcon />} title="No Scores Yet" />
      ) : (
        <ol className="flex flex-col" data-arcade-scores="">
          {rows.map((s, i) => {
            const lit = s.id === litId;
            return (
              <li
                key={s.id}
                data-lit={lit || undefined}
                className={`flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] ${
                  lit
                    ? 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:ring-amber-400/30'
                    : i % 2 === 1
                      ? 'bg-slate-50 dark:bg-slate-800/40'
                      : ''
                }`}
              >
                <span
                  className={`w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums ${
                    i === 0
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                  {s.name}
                </span>
                {myKey !== null && s.by === myKey ? (
                  <span className="shrink-0 rounded-full bg-sky-100 px-1.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-400/15 dark:text-sky-200">
                    You
                  </span>
                ) : null}
                <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {SCORE.format(s.score)}
                </span>
                <span className="w-12 shrink-0 text-right text-[12px] text-slate-500 dark:text-slate-400">
                  {DAY.format(s.at)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {note ? (
        <p className="mt-2 text-center text-[12px] text-slate-500 dark:text-slate-400">{note}</p>
      ) : null}
    </section>
  );
}
