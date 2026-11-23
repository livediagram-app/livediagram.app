'use client';

// Most Read's period, with Pro on (docs/specs/030-knowledgebase/tiers.md "AI Knowledge History"): 30 Days, 90 Days
// and 1 Year in one track. A period longer than the owner's tier keeps carries the Pro mark and opens the upgrade
// offer in place of the period (or says why it is closed, for someone who cannot upgrade). Under it, while the tier
// keeps less than a year, the shared ProNote: "Free keeps 30 days of what agents read and asked. Pro keeps a year."
import { MOST_READ_PERIODS, type KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { HoverCard } from '@liveknowledge/ui';
import { isOwnerScope } from '@liveworkspace/subscription';
import { ProBadge, ProNote, useOwnerView, useUpgrade } from '@liveworkspace/subscription-ui';

type History = NonNullable<KnowledgeOverviewResponse['history']>;

const YEAR = 365;

/** "30 days", "90 days", "year". */
export const periodWords = (days: number): string => (days >= YEAR ? 'year' : `${days} days`);
const periodLabel = (days: number): string => (days >= YEAR ? '1 Year' : `${days} Days`);

/** "Free keeps 30 days of what agents read and asked. Pro keeps a year." */
export const historySentence = (keptDays: number): string =>
  `Free keeps ${keptDays} days of what agents read and asked. Pro keeps a year.`;

/** "History here is kept for 30 days.", for anyone who cannot act on the owner's tier. */
export const historyOthersSentence = (keptDays: number): string =>
  `History here is kept for ${keptDays} days.`;

const SEGMENT =
  'flex min-h-8 flex-1 cursor-pointer items-center px-3 justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed';

export function MostReadPeriod({
  history,
  onPeriod,
}: {
  history: History;
  onPeriod: (days: number) => void;
}) {
  const owner = useOwnerView(isOwnerScope(history.owner) ? history.owner : null);
  const upgrade = useUpgrade();
  const action = owner.status === 'ready' ? owner.view.action : 'none';
  const target = isOwnerScope(history.owner)
    ? { owner: history.owner, limit: 'aiKnowledgeHistoryDays' as const }
    : undefined;
  const offer =
    target && action === 'upgrade'
      ? () => upgrade.openUpgrade(target)
      : target && action === 'ask_admin'
        ? () => upgrade.openAskAdmin(target)
        : null;
  return (
    <div className="mb-3 flex flex-col gap-3">
      <div
        role="group"
        aria-label="Period"
        className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
      >
        {MOST_READ_PERIODS.map((days) => {
          const kept = days <= history.keptDays;
          const active = history.days === days;
          return (
            <HoverCard
              key={days}
              // Each segment takes its share of the group (the card's own wrapper would shrink it to its words).
              className="flex-1"
              title={periodLabel(days)}
              description={
                kept
                  ? `Most read in the last ${periodWords(days)}.`
                  : offer
                    ? 'Part of Pro: Pro keeps a year of history.'
                    : historyOthersSentence(history.keptDays)
              }
            >
              <button
                type="button"
                aria-pressed={active}
                disabled={!kept && !offer}
                data-period={days}
                onClick={() => {
                  if (!kept) offer?.();
                  else if (!active) onPeriod(days);
                }}
                className={`${SEGMENT} ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {periodLabel(days)}
                {kept ? null : <ProBadge form="mark" size="sm" label="Pro" />}
              </button>
            </HoverCard>
          );
        })}
      </div>
      {history.keptDays < YEAR ? (
        <ProNote
          owner={owner}
          limitKey="aiKnowledgeHistoryDays"
          layout="box"
          others={historyOthersSentence(history.keptDays)}
        >
          {historySentence(history.keptDays)}
        </ProNote>
      ) : null}
    </div>
  );
}
