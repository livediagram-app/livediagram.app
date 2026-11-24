'use client';

import { useMemo } from 'react';
import { CompactEmptyState } from '@liveworkspace/ui';
import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { ConnectGlyph } from '../_shared/glyphs';
import { previousSpanLabel, windowHighlightFrom, windowLabel } from '../_shared/windows';
import { agentSignInFigures } from './agent-sign-ins';
import { CARD } from './styles';
import { ChartBlock, SECOND, Tile } from './VisitorsAndAccounts';

// AI Tools & CLI (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): the tokens minted on
// liveworkspace.app's OAuth pages, AI Tools Connected and CLI Sign-ins. Each one's total in the window against the
// span before, then both a day. The one MCP signs every app in, so these are liveworkspace.app's own events and show
// here alone, never on an app's dashboard.
export function AgentSignIns({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const figures = useMemo(() => agentSignInFigures(summary, active), [summary, active]);
  const daily = summary.daily;
  const against = previousSpanLabel(summary, active);
  const highlight = daily ? windowHighlightFrom(daily, active) : 0;
  const { totals } = figures;
  const count = (n: number) => n.toLocaleString('en-GB');

  return (
    <section aria-labelledby="agent-sign-ins">
      <h2
        id="agent-sign-ins"
        className="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100"
      >
        AI Tools &amp; CLI
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        AI tools and CLIs signing in on liveworkspace.app, every app together, in the{' '}
        {windowLabel(active).toLowerCase()}
        {against ? `, against ${against}` : ''}.
      </p>
      <div className={`${CARD} mt-4 p-5`}>
        {!figures.counted || !daily ? (
          <CompactEmptyState
            icon={<ConnectGlyph />}
            title="No sign-ins yet"
            description="No AI tool has connected and no CLI has signed in in the last 30 days."
          />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <Tile
                label="AI Tools Connected"
                value={count(totals.MCP.now)}
                now={totals.MCP.now}
                before={totals.MCP.before}
                against={against}
              />
              <Tile
                label="CLI Sign-ins"
                value={count(totals.Cli.now)}
                now={totals.Cli.now}
                before={totals.Cli.before}
                against={against}
              />
            </dl>
            <div className="mt-6">
              <ChartBlock
                title="AI Tools Connected and CLI Sign-ins per Day"
                caption="AI tools connected and CLI sign-ins per day, last 30 days (UTC)"
                days={daily.days}
                highlight={highlight}
                series={[
                  {
                    label: 'AI Tools Connected',
                    color: 'var(--color-brand-500)',
                    values: figures.daily.MCP,
                  },
                  {
                    label: 'CLI Sign-ins',
                    color: 'currentColor',
                    values: figures.daily.Cli,
                    ...SECOND,
                  },
                ]}
              />
            </div>
          </>
        )}
        <details className="mt-5 text-xs text-slate-500 dark:text-slate-400">
          <summary className="relative cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            What These Count
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
            <li>
              AI Tools Connected is an AI assistant allowed on the MCP consent page, which gives it
              a token. CLI Sign-ins is an app&rsquo;s CLI signed in, through the browser or with a
              code on another device.
            </li>
            <li>
              Before the apps&rsquo; MCPs became one, each app counted these in its own name; those
              days add in here, so the lines carry on.
            </li>
            <li>Tokens made by hand and revoked stay on each app&rsquo;s API Token Activity.</li>
          </ul>
        </details>
      </div>
    </section>
  );
}
