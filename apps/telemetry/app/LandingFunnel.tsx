import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { EmptyState } from '@livediagram/ui';
import { CardColumns } from './CardColumns';
import { SURFACE_LABELS, formatRate, landingFunnel, rate, type FunnelCounts } from './cta-funnel';
import { FunnelSurfaceCard, funnelCardWeight } from './FunnelSurfaceCard';
import { ActivityGlyph } from './glyphs';
import { TrendBadge } from './TrendBadge';
import { rankTrend, windowLabel } from './windows';

// The Pages tab's Landing Funnel (docs/specs/019-marketing/landing-funnel.md): from a public page to a diagram.
// A headline strip across the whole public site, then one card per surface
// with every CTA on it. Three independent counts, divided by each other; no
// event links one visitor's steps.

export function LandingFunnel({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const funnel = landingFunnel(summary.windows[active].rows);
  const trend = rankTrend(summary, active);
  const before = trend ? landingFunnel(trend.rows).total : undefined;
  const { total } = funnel;

  return (
    <section className="mt-8">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Landing funnel
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        From a public page to a diagram, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>. Every call to action into the
        editor names which button it is; the editor counts the arrival and whether a diagram
        followed. Three separate counts, never linked to a person.
      </p>

      {total.views === 0 && total.arrived === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<ActivityGlyph />}
            title="Nothing yet"
            description="No public page views or CTA arrivals in this window yet."
          />
        </div>
      ) : (
        <>
          <Headline total={total} before={before} against={trend?.against} />
          <div className="mt-6">
            <CardColumns>
              {funnel.surfaces.map((surface) => (
                <FunnelSurfaceCard
                  key={surface.surface}
                  surface={surface}
                  weight={funnelCardWeight(surface)}
                />
              ))}
            </CardColumns>
          </div>
          {funnel.quiet.length > 0 ? (
            <p className="mt-4 text-xs text-slate-400">
              No views or arrivals in this window:{' '}
              {funnel.quiet.map((s) => SURFACE_LABELS[s]).join(', ')}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

// The whole public site's funnel: three counts joined by their step rates,
// then the overall rate with what it was in the span before.
function Headline({
  total,
  before,
  against,
}: {
  total: FunnelCounts;
  before: FunnelCounts | undefined;
  against: string | undefined;
}) {
  const overall = rate(total.created, total.views);
  const overallBefore = before ? rate(before.created, before.views) : null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Public page views"
        count={total.views}
        before={before?.views}
        against={against}
      />
      <Stat
        label="Reached the editor"
        count={total.arrived}
        before={before?.arrived}
        against={against}
        step={`${formatRate(rate(total.arrived, total.views))} of views`}
      />
      <Stat
        label="Created a diagram"
        count={total.created}
        before={before?.created}
        against={against}
        step={`${formatRate(rate(total.created, total.arrived))} of arrivals`}
      />
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
        <p className="text-xs font-medium text-brand-700 dark:text-brand-300">Views to diagrams</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-900 dark:text-brand-100">
          {formatRate(overall)}
        </p>
        <p className="mt-1 text-xs text-brand-700/80 dark:text-brand-300/80">
          {before && against
            ? overallBefore === null
              ? `No public page views in ${against}`
              : `${formatRate(overallBefore)} in ${against}`
            : 'Of public page views, how many became a diagram'}
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  count,
  before,
  against,
  step,
}: {
  label: string;
  count: number;
  before: number | undefined;
  against: string | undefined;
  step?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {count.toLocaleString()}
        </span>
        {before !== undefined && against ? (
          <TrendBadge now={count} before={before} against={against} />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-400">{step ?? 'Landing, feature, help and more'}</p>
    </div>
  );
}
