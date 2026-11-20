'use client';

import { useEffect, useState } from 'react';
import { CompactEmptyState } from '@liveworkspace/ui';
import { FORUM_API_PATH, type ForumChecksResponse } from '@liveworkspace/community';
import { communityApiBase } from '../../../components/community/lib/api';
import { ActivityGlyph } from '../_shared/glyphs';
import { CARD } from './styles';
import { ChartBlock, SECOND, Tile } from './VisitorsAndAccounts';

// The Forum's check (liveworkspace/docs/specs/007-community/community.md "The check"; liveworkspace/docs/specs/
// 008-telemetry/telemetry.md "The dashboard"): each day's checks and the Neurons they used, against what a day may use.
// The Community service keeps the tally in its own database (the service sends no events: it holds no telemetry key),
// so it is read from its public counts route, not from the telemetry summary.

const count = (n: number) => n.toLocaleString('en-GB');

type State =
  { status: 'loading' } | { status: 'failed' } | { status: 'ok'; data: ForumChecksResponse };

export function ForumChecks() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${communityApiBase(undefined)}${FORUM_API_PATH}/checks`, { signal: controller.signal })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<ForumChecksResponse>)
          : Promise.reject(new Error(`${res.status}`)),
      )
      .then((data) => setState({ status: 'ok', data }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'failed' });
      });
    return () => controller.abort();
  }, []);

  return (
    <section aria-labelledby="forum-checks">
      <h2
        id="forum-checks"
        className="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        Forum Checks
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Each post, reply and edit in the Community Forum is read by Workers AI before anyone else
        sees it. A day may make a set number of checks and use a set number of Neurons.
      </p>
      <div className={`${CARD} mt-4 p-5`}>
        <Body state={state} />
      </div>
    </section>
  );
}

function Body({ state }: { state: State }) {
  if (state.status !== 'ok') {
    return (
      <CompactEmptyState
        icon={<ActivityGlyph />}
        title={state.status === 'loading' ? 'Loading Forum Checks' : 'Forum Checks Unavailable'}
        description={
          state.status === 'loading'
            ? 'Reading the Community service.'
            : 'The Community service did not answer. Try again in a minute.'
        }
      />
    );
  }
  const { caps, days } = state.data;
  const today = days[days.length - 1]!;
  const checks = today.listed + today.refused + today.waiting;
  const days30 = days.map((d) => d.day);
  const total = (pick: (d: (typeof days)[number]) => number) => days.map(pick);
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Checks Today"
          value={count(checks)}
          detail={`of ${count(caps.checks)} a day`}
        />
        <Tile
          label="Neurons Today"
          value={count(today.neurons)}
          detail={`of ${count(caps.neurons)} a day`}
        />
        <Tile label="Waiting Today" value={count(today.waiting)} rising="bad" />
        <Tile
          label="Neurons per Check"
          value={
            today.listed + today.refused > 0
              ? (today.neurons / (today.listed + today.refused)).toFixed(1)
              : '0'
          }
        />
      </dl>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartBlock
          title="Checks per Day against the Cap"
          caption="Forum checks per day against the daily cap, last 30 days (UTC)"
          days={days30}
          highlight={days30.length}
          series={[
            {
              label: 'Checks',
              color: 'var(--color-brand-500)',
              values: total((d) => d.listed + d.refused + d.waiting),
            },
            {
              label: 'Cap',
              color: 'currentColor',
              values: total(() => caps.checks),
              ...SECOND,
            },
          ]}
        />
        <ChartBlock
          title="Neurons per Day against the Budget"
          caption="Neurons the Forum's check used per day against the daily budget, last 30 days (UTC)"
          days={days30}
          highlight={days30.length}
          series={[
            {
              label: 'Neurons',
              color: 'var(--color-brand-500)',
              values: total((d) => d.neurons),
            },
            {
              label: 'Budget',
              color: 'currentColor',
              values: total(() => caps.neurons),
              ...SECOND,
            },
          ]}
        />
      </div>
      <details className="mt-5 text-xs text-slate-500 dark:text-slate-400">
        <summary className="relative cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
          What These Count
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
          <li>
            A check is one ask of the content safety model. Waiting is a check that could not answer
            (the cap, a slow model, an error), so its post waits as Pending for the cron.
          </li>
          <li>
            Neurons are worked out from the tokens the model reports, at Workers AI&apos;s list
            price. Workers AI is free up to 10,000 Neurons a day for the whole account.
          </li>
        </ul>
      </details>
    </>
  );
}
