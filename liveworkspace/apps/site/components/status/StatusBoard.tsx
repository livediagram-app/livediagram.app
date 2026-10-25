'use client';

import { BrandMark, lucideGlyph } from '@livediagram/ui';
import { lucideHistory, lucideRefreshCw } from '@liveworkspace/icons/lucide';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import {
  allServices,
  environmentOf,
  type StatusEnvironment,
  type StatusHistory,
  statusGroups,
} from '@liveworkspace/status';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppMark } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';
import {
  appendHistory,
  type CheckResult,
  OVERALL_COPY,
  REFRESH_MS,
  runRound,
  summarise,
  viewServices,
} from '@/lib/status/probe';
import { HISTORY_REFRESH_MS, hasRuns, incidentsByService, loadHistory } from '@/lib/status/history';
import { RecentIncidents } from './RecentIncidents';
import { ServiceGroupCard } from './ServiceGroupCard';
import { formatAgo, formatMs, Legend, OVERALL_LOOK, StateBadge } from './status-ui';

const RefreshIcon = lucideGlyph(lucideRefreshCw, 16);
const HistoryIcon = lucideGlyph(lucideHistory, 16);

const noSubscription = () => () => {};

// The status page's live board (liveworkspace/docs/site.md "Status"). A round of checks runs on load, then every
// REFRESH_MS while the tab is visible; a hidden tab pauses and checks again on its return. Check now runs one at
// once. Beside them, liveworkspace's hourly checks and their 90 days (liveworkspace/docs/status.md): read once on load
// and again every HISTORY_REFRESH_MS while visible. Without them (no Worker, no runs yet) it shows this visit's alone.
export function StatusBoard({
  fetchImpl,
  environment,
}: {
  // Tests hand in their own fetch, and say where the page is; the page uses the browser's, and its address.
  fetchImpl?: typeof fetch;
  environment?: StatusEnvironment;
}) {
  // Where the page is (production, staging or a dev server) decides each app's address: known only in the browser,
  // so the prerender has none and the checks start once the page is up.
  const detected = useSyncExternalStore(
    noSubscription,
    () => environmentOf(window.location.host),
    () => null,
  );
  const env = environment ?? detected;
  const groups = useMemo(() => statusGroups(env ?? 'production'), [env]);
  const services = useMemo(() => allServices(groups), [groups]);
  const [history, setHistory] = useState<ReadonlyMap<string, readonly CheckResult[]>>(new Map());
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [nextAt, setNextAt] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const runningRef = useRef(false);
  // The stored history: undefined while the first read is out, null when there is none to show.
  const [stored, setStored] = useState<StatusHistory | null | undefined>(undefined);
  const [storedAt, setStoredAt] = useState<number | null>(null);
  const loadingStored = useRef(false);

  const views = useMemo(() => viewServices(services, history), [services, history]);
  const summary = useMemo(() => summarise(services, views), [services, views]);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      const results = await runRound(groups, fetchImpl ?? globalThis.fetch.bind(globalThis));
      setHistory((prev) => appendHistory(prev, results));
    } finally {
      runningRef.current = false;
      setRunning(false);
      setNow(Date.now());
      setNextAt(Date.now() + REFRESH_MS);
    }
  }, [groups, fetchImpl]);

  const readStored = useCallback(async () => {
    if (loadingStored.current) return;
    loadingStored.current = true;
    try {
      setStored(await loadHistory(fetchImpl ?? globalThis.fetch.bind(globalThis)));
    } finally {
      loadingStored.current = false;
      setStoredAt(Date.now());
    }
  }, [fetchImpl]);

  // The stored history: once on load, then again when it is due and the tab is visible.
  useEffect(() => {
    void readStored();
  }, [readStored]);
  useEffect(() => {
    if (visible && storedAt !== null && now !== null && now - storedAt >= HISTORY_REFRESH_MS)
      void readStored();
  }, [visible, storedAt, now, readStored]);
  const hourly = hasRuns(stored ?? null) ? (stored as StatusHistory) : null;
  const incidents = useMemo(() => (hourly ? incidentsByService(hourly) : undefined), [hourly]);
  // The cards' clock, for "Checked by liveworkspace 23 min ago": a minute is fine enough for an hourly check.
  const minute = now === null ? null : Math.round(now / 60_000) * 60_000;

  // The first round, once the address is known.
  useEffect(() => {
    if (env !== null) void run();
  }, [env, run]);

  // A hidden tab checks nothing; coming back runs a round if one is due.
  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState !== 'hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // A one-second tick for the countdown and the "checked … ago" line, only while visible.
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (visible && !running && nextAt !== null && now !== null && now >= nextAt) void run();
  }, [visible, running, nextAt, now, run]);

  const copy = OVERALL_COPY[summary.overall];
  const look = OVERALL_LOOK[summary.overall];
  const OverallIcon = look.icon;
  const remaining =
    nextAt !== null && now !== null ? Math.max(0, Math.ceil((nextAt - now) / 1000)) : null;

  // Announced when the overall state changes: the words stay the same from round to round, so a live region
  // says nothing new until they do.
  const announced = summary.overall === 'checking' ? '' : copy.title;

  const [platform, ...apps] = groups;

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_0%,rgb(14_165_233/0.10),transparent_70%),radial-gradient(60%_60%_at_95%_30%,rgb(139_92_246/0.10),transparent_70%)] dark:bg-[radial-gradient(70%_60%_at_15%_0%,rgb(14_165_233/0.14),transparent_70%),radial-gradient(60%_60%_at_95%_30%,rgb(139_92_246/0.16),transparent_70%)]"
        />
        <div
          aria-hidden
          style={{ '--lw-glow': look.glow } as CSSProperties}
          className="pointer-events-none absolute inset-0 [background:radial-gradient(45%_55%_at_80%_35%,var(--lw-glow),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-12 pb-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.4fr_1fr] lg:pt-20 lg:pb-16">
          <div className="lw-status-rise min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 py-1 pr-3.5 pl-1.5 text-sm font-medium text-slate-600 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <BrandMark accentColor={PLATFORM_SITE.accent} className="size-4" />
              </span>
              Status of liveworkspace and every app
            </p>
            <h1
              className={`mt-6 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-6xl ${look.ink}`}
            >
              {copy.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              {copy.line}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Every check runs live from your browser, every minute while this page is open. Beside
              them, liveworkspace checks every service from Cloudflare each hour and keeps 90 days.
            </p>
          </div>

          <div className="lw-status-rise flex justify-center [animation-delay:120ms] lg:justify-end">
            <div className="relative flex size-36 items-center justify-center sm:size-52">
              <span
                aria-hidden
                className={`lw-status-ping absolute inset-6 rounded-full opacity-40 ${look.orb}`}
              />
              <span
                aria-hidden
                className={`absolute inset-3 rounded-full opacity-15 ${look.orb}`}
              />
              <CountdownRing remaining={remaining} running={running} />
              <span
                aria-hidden
                className={`relative flex size-20 items-center justify-center rounded-full text-white shadow-xl shadow-slate-900/10 ring-8 ring-white/70 sm:size-28 dark:ring-slate-950/60 ${look.orb}`}
              >
                <span
                  className={
                    summary.overall === 'checking' ? 'lw-status-spin inline-flex' : 'inline-flex'
                  }
                >
                  <OverallIcon />
                </span>
              </span>
            </div>
          </div>

          <dl className="lw-status-rise grid grid-cols-2 gap-3 [animation-delay:180ms] sm:grid-cols-4 lg:col-span-2">
            <Stat
              label="Answering"
              value={summary.total ? `${summary.answered} of ${summary.total}` : '—'}
              hint="services checked here"
            />
            <Stat
              label="Median answer"
              value={summary.medianMs === null ? '—' : formatMs(summary.medianMs)}
              hint="this round"
            />
            <Stat
              label="Last checked"
              value={summary.lastAt !== null && now !== null ? formatAgo(summary.lastAt, now) : '—'}
              hint={
                summary.lastAt !== null ? (
                  <time dateTime={new Date(summary.lastAt).toISOString()}>
                    {new Date(summary.lastAt).toLocaleTimeString()}
                  </time>
                ) : (
                  'waiting for the first answers'
                )
              }
            />
            <div className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Next check</dt>
              <dd className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                  {running
                    ? 'Now'
                    : remaining !== null
                      ? visible
                        ? `${remaining} s`
                        : 'Paused'
                      : '—'}
                </span>
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={running}
                  className="relative touch-target-y inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-micro hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-progress disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:focus-visible:outline-white"
                >
                  <span className={running ? 'lw-status-spin inline-flex' : 'inline-flex'}>
                    <RefreshIcon />
                  </span>
                  Check now
                </button>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-20 sm:px-6 sm:pb-24">
        <nav aria-label="Groups" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {groups.map((g) => {
              const s = summarise(g.services, views);
              const mark =
                s.overall === 'checking' ? 'checking' : s.down ? 'down' : s.slow ? 'slow' : 'up';
              const words =
                mark === 'checking'
                  ? 'Checking'
                  : mark === 'down'
                    ? `${s.down} down`
                    : mark === 'slow'
                      ? `${s.slow} slow`
                      : 'All up';
              return (
                <li key={g.id}>
                  <a
                    href={`#${g.id}`}
                    className="relative touch-target-y inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-1 pl-3 text-sm font-medium text-slate-700 transition-colors duration-micro hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <GroupMark id={g.site.id} />
                    {g.title}
                    <StateBadge state={mark} size="sm" word={words} />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {stored !== undefined && !hourly ? (
          <p
            data-history="unavailable"
            className="flex items-start gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400"
          >
            <span aria-hidden className="mt-0.5 inline-flex shrink-0">
              <HistoryIcon />
            </span>
            liveworkspace’s hourly history isn’t available right now, so this page shows your
            browser’s live checks alone.
          </p>
        ) : null}

        {platform ? (
          <ServiceGroupCard
            group={platform}
            views={views}
            wide
            history={hourly}
            incidents={incidents}
            now={minute}
          />
        ) : null}
        <div className="grid gap-6 lg:grid-cols-2">
          {apps.map((g) => (
            <ServiceGroupCard
              key={g.id}
              group={g}
              views={views}
              history={hourly}
              incidents={incidents}
              now={minute}
            />
          ))}
        </div>

        {hourly ? <RecentIncidents history={hourly} groups={groups} /> : null}

        <Legend>
          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-600 sm:grid-cols-2 dark:border-slate-800 dark:text-slate-400">
            <p>
              <strong className="font-semibold text-slate-800 dark:text-slate-200">
                Your browser’s checks.
              </strong>{' '}
              The first line of each service, by the person icon: a request your browser makes to an
              address the service already answers, timed from here. A service down for you may be up
              for others, and the other way round. Its strip holds the checks since you opened this
              page, at most 30, and forgets them when you leave.
            </p>
            <p>
              <strong className="font-semibold text-slate-800 dark:text-slate-200">
                liveworkspace’s hourly checks.
              </strong>{' '}
              The second line, by the cloud: the same check, made from Cloudflare every hour, which
              can read every answer, so it never needs to say Reached. Under it, a bar per day for
              the last 90 days: taller and green when the service was up all day, shorter and amber
              or red for its worst slow or down check, a stub for a day without checks. Hover, tap
              or focus the bars for the day.
            </p>
          </div>
        </Legend>
      </div>
    </>
  );
}

// A group's prism on its jump link: the app's own, or liveworkspace's in its slate.
function GroupMark({ id }: { id: string }) {
  const app = listedApps().find((a) => a.id === id);
  return app ? (
    <AppMark app={app} className="size-4" />
  ) : (
    <BrandMark accentColor={PLATFORM_SITE.accent} className="size-4" />
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
        {value}
      </dd>
      <dd className="truncate text-xs text-slate-500 dark:text-slate-400">{hint}</dd>
    </div>
  );
}

// The time to the next round, as a ring that empties over the minute.
function CountdownRing({ remaining, running }: { remaining: number | null; running: boolean }) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const fraction = running || remaining === null ? 1 : remaining / (REFRESH_MS / 1000);
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="1.5"
        className="stroke-slate-200 dark:stroke-slate-800"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        className="stroke-slate-500 dark:stroke-slate-400"
      />
    </svg>
  );
}
