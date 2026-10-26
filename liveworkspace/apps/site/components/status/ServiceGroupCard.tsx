import { lucideGlyph } from '@livediagram/ui';
import { lucideArrowUpRight, lucideCloud, lucideUser } from '@liveworkspace/icons/lucide';
import {
  type IncidentEntry,
  type LatestEntry,
  type Service,
  type ServiceGroup,
  STATE_OF_LETTER,
  type StatusHistory,
} from '@liveworkspace/status';
import { type CSSProperties, memo } from 'react';
import { AppLogo } from '@/components/landing/AppLogo';
import { Wordmark } from '@/components/Wordmark';
import { listedApps } from '@/lib/apps';
import { summarise, type ServiceView } from '@/lib/status/probe';
import { formatAgo, formatMs, HistoryStrip, ServiceIcon, StateBadge } from './status-ui';
import { UptimeBars } from './UptimeBars';

const ArrowIcon = lucideGlyph(lucideArrowUpRight, 14);
const BrowserIcon = lucideGlyph(lucideUser, 13);
const HourlyIcon = lucideGlyph(lucideCloud, 13);

// One group of services (liveworkspace/docs/specs/010-site/site.md "Status"): liveworkspace's under its wordmark, or an app's under
// its own logo (never a coloured dot), with the group's own summary and a row per service. Each row has this visit's
// check and, when the hourly history is in, liveworkspace's last check and the service's 90 days.
// Memoised, with a clock that moves once a minute: the board's one-second tick re-renders none of it.
export const ServiceGroupCard = memo(function ServiceGroupCard({
  group,
  views,
  wide = false,
  history = null,
  incidents,
  now = null,
}: {
  group: ServiceGroup;
  views: ReadonlyMap<string, ServiceView>;
  // liveworkspace's group spans the page, its services in columns.
  wide?: boolean;
  // The stored history, or null to show this visit's checks alone.
  history?: StatusHistory | null;
  incidents?: ReadonlyMap<string, IncidentEntry[]>;
  now?: number | null;
}) {
  const app = listedApps().find((a) => a.id === group.site.id);
  const summary = summarise(group.services, views);
  const ink = { '--lw-ink': group.site.deep, '--lw-ink-dark': group.site.accent } as CSSProperties;
  const groupState =
    summary.overall === 'operational'
      ? 'up'
      : summary.overall === 'slow'
        ? 'slow'
        : summary.overall === 'checking'
          ? 'checking'
          : 'down';
  const groupWords =
    summary.overall === 'checking'
      ? 'Checking'
      : summary.down > 0
        ? `${summary.down} of ${summary.total} down`
        : summary.slow > 0
          ? `${summary.slow} of ${summary.total} slow`
          : `All ${summary.total} up`;
  return (
    <section
      id={group.id}
      aria-labelledby={`${group.id}-title`}
      style={ink}
      className="lw-status-rise scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-slate-100 px-5 py-5 sm:px-7 dark:border-slate-800">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_120%_at_0%_0%,color-mix(in_oklab,var(--lw-ink-dark)_14%,transparent),transparent_70%)]"
        />
        <div className="relative min-w-0">
          <h2 id={`${group.id}-title`} className="flex items-center">
            <span className="sr-only">{group.title}</span>
            <span aria-hidden className="inline-flex">
              {app ? <AppLogo app={app} size="md" /> : <Wordmark className="text-xl" />}
            </span>
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{group.blurb}</p>
        </div>
        <div className="relative flex items-center gap-2">
          <StateBadge state={groupState} word={groupWords} />
          <a
            href={group.site.url}
            aria-label={`Open ${group.title}`}
            className="relative touch-target-y inline-flex size-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors duration-micro hover:border-[var(--lw-ink)] hover:text-[var(--lw-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lw-ink)] dark:border-slate-700 dark:text-slate-400 dark:hover:border-[var(--lw-ink-dark)] dark:hover:text-[var(--lw-ink-dark)]"
          >
            <ArrowIcon />
          </a>
        </div>
      </header>
      <ul
        className={
          wide
            ? 'grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-800'
            : 'divide-y divide-slate-100 dark:divide-slate-800'
        }
      >
        {group.services.map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            view={views.get(service.id)}
            wide={wide}
            history={history}
            incidents={incidents?.get(service.id) ?? NONE}
            now={now}
          />
        ))}
      </ul>
    </section>
  );
});

const NONE: IncidentEntry[] = [];

function ServiceRow({
  service,
  view,
  wide,
  history,
  incidents,
  now,
}: {
  service: Service;
  view: ServiceView | undefined;
  wide: boolean;
  history: StatusHistory | null;
  incidents: readonly IncidentEntry[];
  now: number | null;
}) {
  const state = view?.state ?? 'checking';
  const latest = view?.latest ?? null;
  const evidence =
    service.check.mode === 'skipped'
      ? service.check.reason
      : service.check.mode === 'derived'
        ? (view?.via ?? service.label)
        : latest
          ? latest.detail
          : service.label;
  return (
    <li
      data-service={service.id}
      data-state={state}
      className={`flex min-w-0 flex-col gap-3 px-5 py-4 sm:px-7 ${wide ? 'bg-white dark:bg-slate-900' : ''}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--lw-ink)_10%,white)] text-[var(--lw-ink)] dark:bg-[color-mix(in_oklab,var(--lw-ink-dark)_16%,transparent)] dark:text-[var(--lw-ink-dark)]"
        >
          <ServiceIcon name={service.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{service.name}</h3>
            <StateBadge state={state} size="sm" />
          </div>
          <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-400">
            {service.description}
          </p>
          {/* A service with no check of its own says which check stands for it. */}
          {service.check.mode === 'derived' ? (
            <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
              {service.check.note}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2 pl-12 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex w-3.5 shrink-0 text-slate-400 dark:text-slate-500">
            <BrowserIcon />
            <span className="sr-only">From your browser:</span>
          </span>
          <span
            className="w-14 shrink-0 font-mono tabular-nums text-slate-700 dark:text-slate-200"
            aria-label={
              latest && state !== 'skipped' ? `Answered in ${formatMs(latest.ms)}` : undefined
            }
          >
            {latest && state !== 'skipped' ? formatMs(latest.ms) : '—'}
          </span>
          <span className="min-w-0 flex-1 leading-snug">{evidence}</span>
          {service.check.mode === 'probe' ? (
            <span className="ml-auto w-20 shrink-0 sm:w-28">
              <HistoryStrip history={view?.history ?? []} />
            </span>
          ) : null}
        </div>
        {history && history.at !== null ? (
          <>
            <HourlyLine service={service} entry={history.latest[service.id] ?? null} />
            <div className="pt-1">
              <UptimeBars
                history={history}
                serviceId={service.id}
                incidents={incidents}
                checked={<CheckedAgo at={history.at} now={now} />}
              />
            </div>
          </>
        ) : null}
      </div>
    </li>
  );
}

const ERROR_DETAIL: Record<string, string> = {
  timeout: 'Timed out',
  network: 'No answer',
};

// When the hourly run was: "Checked by liveworkspace 23 min ago".
function CheckedAgo({ at, now }: { at: number; now: number | null }) {
  return (
    <time dateTime={new Date(at).toISOString()}>
      Checked by liveworkspace {now === null ? 'this hour' : formatAgo(at, now)}
    </time>
  );
}

// liveworkspace's own last check of the service, from Cloudflare: how long it took, its answer, and its state as an icon
// and a word, in the same columns as this visit's line above it.
function HourlyLine({ service, entry }: { service: Service; entry: LatestEntry | null }) {
  const icon = (
    <span className="inline-flex w-3.5 shrink-0 text-slate-400 dark:text-slate-500">
      <HourlyIcon />
      <span className="sr-only">From liveworkspace’s hourly check:</span>
    </span>
  );
  if (!entry) {
    return (
      <div className="flex min-w-0 items-center gap-3" data-hourly="none">
        {icon}
        <span className="min-w-0 flex-1 leading-snug">Not checked hourly from here.</span>
      </div>
    );
  }
  const [letter, code, ms, error] = entry;
  const state = STATE_OF_LETTER[letter];
  const says =
    service.check.mode === 'probe' && service.check.probe.kind === 'read'
      ? service.check.probe.says
      : undefined;
  const detail = error
    ? (ERROR_DETAIL[error] ?? (error === 'not_json' ? `HTTP ${code}, not JSON` : `HTTP ${code}`))
    : (says ?? (code === null ? 'Answered' : `HTTP ${code}`));
  return (
    <div className="flex min-w-0 items-center gap-3" data-hourly={state}>
      {icon}
      <span className="w-14 shrink-0 font-mono tabular-nums text-slate-700 dark:text-slate-200">
        {formatMs(ms)}
      </span>
      <span className="min-w-0 flex-1 leading-snug">{detail}</span>
      <span className="ml-auto shrink-0">
        <StateBadge state={state} size="sm" />
      </span>
    </div>
  );
}
