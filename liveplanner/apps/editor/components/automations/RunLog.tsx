'use client';

// The Audit Trail tab (docs/specs/026-plan/automations.md "The Automations screen": Audit Trail): the All Rules, Any Result
// and Last 7 Days filters, the line saying how long runs are kept, then the runs newest first, each opening to its
// steps. Read when the tab opens and whenever a filter changes; a skeleton while it loads, an empty state with no
// runs, and Try Again when the read failed.

import { useEffect, useState } from 'react';
import type { AutomationResult, AutomationRun } from '@liveplanner/items';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import { CompactEmptyState, NoMatches, Select } from '@liveplanner/ui';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { listRuns, type AutomationsScope } from './automations-client';
import { BoltIcon } from './automation-glyphs';
import { RUN_GRID, RunRow } from './RunRow';
import { RESULT_LABELS } from './run-words';

// The most runs one read shows (the route's own cap, 200).
export const RUN_LOG_LIMIT = 200;

const DAY_MS = 24 * 60 * 60 * 1000;
export const RUN_WINDOWS = [
  { value: 1, label: 'Today' },
  { value: 7, label: 'Last 7 Days' },
  { value: 30, label: 'Last 30 Days' },
] as const;
export type RunWindow = (typeof RUN_WINDOWS)[number]['value'];

const RESULTS: readonly AutomationResult[] = ['done', 'no_match', 'skipped', 'failed'];
const FILTER_SELECT = 'h-8 rounded-lg pl-3 pr-7 text-[13px]';

/** The start of a window: today's midnight for Today, else that many days back from now. */
export function windowStart(days: RunWindow, now: number): number {
  if (days === 1) return new Date(now).setHours(0, 0, 0, 0);
  return now - days * DAY_MS;
}

// The last answer and the read it answered: a read whose key differs from the filters' is still loading.
type Answer = { key: string; status: 'ready' | 'error'; runs: readonly AutomationRun[] };

export function RunLog({
  scope,
  rules,
  now,
  phone,
  initialRule,
  onOpenCard,
}: {
  scope: AutomationsScope;
  rules: readonly AutomationListedRule[];
  now: number;
  phone: boolean;
  // A rule's ⋯ Audit Trail opens on its runs.
  initialRule?: string | undefined;
  onOpenCard: (cardId: string) => void;
}) {
  const [rule, setRule] = useState(initialRule ?? '');
  const [result, setResult] = useState<AutomationResult | ''>('');
  const [days, setDays] = useState<RunWindow>(7);
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer>({ key: '', status: 'ready', runs: [] });
  // The window's start moves with the clock only through the filter, so a minute's tick reads nothing again.
  const [since, setSince] = useState(() => windowStart(7, now));

  const key = `${rule}|${result}|${since}|${attempt}`;
  useEffect(() => {
    let live = true;
    listRuns(scope, {
      ...(rule ? { rule } : {}),
      ...(result ? { result } : {}),
      since,
      limit: RUN_LOG_LIMIT,
    }).then(
      (got) => {
        if (live) setAnswer({ key, status: 'ready', runs: got.runs });
      },
      (error: unknown) => {
        debugLog('[automations] runs.failed', { error: String(error) });
        if (live) setAnswer((a) => ({ key, status: 'error', runs: a.runs }));
      },
    );
    return () => {
      live = false;
    };
  }, [scope, rule, result, since, key]);
  const read = {
    status: answer.key === key ? answer.status : 'loading',
    runs: answer.runs,
  } as const;

  const filters = (rule ? 1 : 0) + (result ? 1 : 0) + (days === 7 ? 0 : 1);
  const clear = () => {
    setRule('');
    setResult('');
    setDays(7);
    setSince(windowStart(7, Date.now()));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex flex-wrap items-center gap-2 ${phone ? 'px-4 py-3' : 'px-5 py-3.5'}`}>
        <Select
          aria-label="Rule"
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          selectClassName={FILTER_SELECT}
        >
          <option value="">All Rules</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Result"
          value={result}
          onChange={(e) => setResult(e.target.value as AutomationResult | '')}
          selectClassName={FILTER_SELECT}
        >
          <option value="">Any Result</option>
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {RESULT_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="When"
          value={days}
          onChange={(e) => {
            const next = Number(e.target.value) as RunWindow;
            setDays(next);
            setSince(windowStart(next, Date.now()));
          }}
          selectClassName={FILTER_SELECT}
        >
          {RUN_WINDOWS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </Select>
        <span className="flex-1" />
        <span className="text-[12px] text-slate-500 dark:text-slate-400">
          Kept for 30 days or the last 2,000 runs
        </span>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto ${phone ? 'pb-2' : 'px-5 pb-5'}`}>
        {read.status === 'error' && read.runs.length === 0 ? (
          <CompactEmptyState
            role="status"
            icon={<BoltIcon size={18} />}
            title="Couldn’t Load the Audit Trail"
            description="Check your connection and try again."
            action={
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="rounded-md px-2 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 motion-reduce:transition-none pointer-coarse:py-2 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                Try Again
              </button>
            }
          />
        ) : read.status === 'loading' && read.runs.length === 0 ? (
          <div
            role="status"
            aria-label="Loading runs"
            data-run-log-loading=""
            className="flex flex-col gap-2 pt-2"
          >
            {[0.7, 0.5, 0.62].map((w, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
                style={{ opacity: w }}
              />
            ))}
          </div>
        ) : read.runs.length === 0 ? (
          filters > 0 ? (
            <NoMatches things="runs" filters={filters} onClear={clear} />
          ) : (
            <CompactEmptyState
              role="status"
              icon={<BoltIcon size={18} />}
              title="No Runs Yet"
              description="Each time a rule answers a change, its run shows here: what it found and what it did."
            />
          )
        ) : (
          <>
            {phone ? null : (
              <div
                aria-hidden
                className={`${RUN_GRID} border-b border-slate-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400`}
              >
                <span>When</span>
                <span>Rule</span>
                <span>Card</span>
                <span>Result</span>
                <span>Took</span>
                <span />
              </div>
            )}
            <ul
              aria-label="Runs"
              aria-busy={read.status === 'loading'}
              className="flex flex-col gap-0.5"
            >
              {read.runs.map((run) => (
                <RunRow key={run.id} run={run} now={now} phone={phone} onOpenCard={onOpenCard} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
