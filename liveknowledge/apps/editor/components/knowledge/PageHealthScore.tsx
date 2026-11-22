'use client';

// The Health Score at the top of Page Health (docs/specs/030-knowledgebase/verification.md "In Page Health"): the
// score in a ring that fills to it, its word (never colour alone) and the main reason, then Score Breakdown, closed
// by default: each factor's points of its maximum and what would raise it, with a button where the fix is a press
// away and the person may make it. From plain props: the score is worked out by usePageHealthScore.
import { useId, useState } from 'react';
import {
  HEALTH_FACTOR_WORDS,
  HEALTH_LABEL_WORDS,
  type PageHealthFix,
  type PageHealthLabel,
  type PageHealthScore as Score,
} from '@liveknowledge/knowledge';
import { CheckIcon, DisclosureIcon, HeadingIcon, OwnerIcon } from './knowledge-icons';

/** The fixes this person may make, each absent where they may not. */
export type PageHealthFixes = Partial<Record<PageHealthFix, () => void>>;

// The word's tone, from the trust palette: green as Verified, amber as Review Due, rose as a refusal.
export const HEALTH_TONE: Record<PageHealthLabel, { ink: string; fill: string; chip: string }> = {
  healthy: {
    ink: 'text-brand-700 dark:text-brand-300',
    fill: 'bg-brand-600 dark:bg-brand-400',
    chip: 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-200 dark:ring-brand-800/60',
  },
  fair: {
    ink: 'text-amber-700 dark:text-amber-300',
    fill: 'bg-amber-500 dark:bg-amber-400',
    chip: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/50',
  },
  'needs-work': {
    ink: 'text-rose-700 dark:text-rose-300',
    fill: 'bg-rose-500 dark:bg-rose-400',
    chip: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800/50',
  },
};

const FIX_WORDS: Record<PageHealthFix, string> = {
  verify: 'Verify',
  owner: 'Set an Owner',
  heading: 'Add a Heading',
};
const FIX_ICONS: Record<PageHealthFix, () => React.JSX.Element> = {
  verify: CheckIcon,
  owner: OwnerIcon,
  heading: HeadingIcon,
};

// The ring: the score's share of 100 in the word's colour over a faint track, the figure inside.
function ScoreRing({ score, label }: { score: number; label: PageHealthLabel }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <span
      aria-hidden
      className={`relative flex size-14 shrink-0 items-center justify-center ${HEALTH_TONE[label].ink}`}
    >
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-14 -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-slate-200/80 dark:stroke-slate-800"
        />
        <circle
          data-score-arc=""
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={`${c * Math.max(0.02, score / 100)} ${c}`}
          className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-200"
        />
      </svg>
      <span className="text-optical-centre text-lg font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
        {score}
      </span>
    </span>
  );
}

export function PageHealthScore({
  health,
  fixes,
  offline = false,
}: {
  health: Score;
  fixes: PageHealthFixes;
  /** Kept in this browser: reads and open issues are not counted. */
  offline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const word = HEALTH_LABEL_WORDS[health.label];
  return (
    <div data-health-score={health.label} className="mt-3">
      <div
        role="img"
        aria-label={`Health Score ${health.score} of 100, ${word}: ${health.reason}`}
        className="flex items-center gap-3.5"
      >
        <ScoreRing score={health.score} label={health.label} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-baseline gap-2">
            <span
              data-health-word=""
              className={`text-[15px] font-semibold tracking-tight ${HEALTH_TONE[health.label].ink}`}
            >
              {word}
            </span>
            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Health Score
            </span>
          </p>
          <p data-health-reason="" className="truncate text-xs text-slate-600 dark:text-slate-400">
            {health.reason}
          </p>
        </div>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((was) => !was)}
        className="mt-2 flex min-h-8 w-full cursor-pointer items-center justify-between rounded-md px-1 text-xs font-medium text-slate-600 transition hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-400 dark:hover:text-slate-100"
      >
        Score Breakdown
        <span
          className={`flex text-slate-400 motion-safe:transition-transform motion-safe:duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <DisclosureIcon />
        </span>
      </button>
      {open ? (
        <div id={panel}>
          <ul className="flex flex-col gap-2.5 pt-1" aria-label="Score Breakdown">
            {health.factors.map((f) => {
              const fix = f.fix ? fixes[f.fix] : undefined;
              const Icon = f.fix ? FIX_ICONS[f.fix] : null;
              return (
                <li key={f.factor} data-health-factor={f.factor} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {HEALTH_FACTOR_WORDS[f.factor]}
                    </span>
                    <span className="tabular-nums text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {f.points}
                      </span>{' '}
                      / {f.max}
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
                  >
                    <span
                      className={`block h-full rounded-full ${HEALTH_TONE[f.points === f.max ? 'healthy' : f.points * 2 >= f.max ? 'fair' : 'needs-work'].fill}`}
                      style={{ width: `${(100 * f.points) / f.max}%` }}
                    />
                  </span>
                  {f.raise ? (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="min-w-0 text-slate-500 dark:text-slate-400">{f.raise}</span>
                      {fix && f.fix && Icon ? (
                        <button
                          type="button"
                          onClick={fix}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100"
                        >
                          <Icon />
                          {FIX_WORDS[f.fix]}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {offline ? (
            <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              Kept in this browser: reads and open issues are not counted.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
