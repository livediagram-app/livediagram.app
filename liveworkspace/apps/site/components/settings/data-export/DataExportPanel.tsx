'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EXPORT_POLL_MS,
  isExportLinkRefusal,
  type DataExportState,
  type ExportView,
} from '@liveworkspace/data-export';
import { SettingsSharedGlyph } from '@liveworkspace/settings-ui';
import { accountApi, errorMessage } from '@/lib/account-api';
import { EXPORT_LINK_PARAM } from '@/lib/explorer/host';
import { BUTTON, ErrorNote } from '../account-ui';
import { EveryAppName } from '../app-names';
import { REFUSALS, startError } from './data-export-copy';
import { ExportRow } from './ExportRow';

type Load =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  // `at`: when it was read, so a lapsed link reads as lapsed.
  | { state: 'ready'; data: DataExportState; at: number };

const PATH = '/data-export';
const read = () => accountApi<DataExportState>(PATH);
const loadOf = (result: Awaited<ReturnType<typeof read>>): Load =>
  result.ok
    ? { state: 'ready', data: result.data, at: Date.now() }
    : { state: 'error', error: result.error };

// A row's key: `personal`, or the team's id.
const PERSONAL = 'personal';

const running = (data: DataExportState) =>
  data.personal?.status === 'running' || data.teams.some((t) => t.export?.status === 'running');

// Why the emailed link sent the person here (`?settings=data&export=<why>`), read once as the panel opens.
function refusalOnArrival(): string | null {
  if (typeof window === 'undefined') return null;
  const why = new URLSearchParams(window.location.search).get(EXPORT_LINK_PARAM);
  return isExportLinkRefusal(why) ? REFUSALS[why] : null;
}

// Settings › Your Data (liveworkspace/docs/specs/010-site/site.md "Settings", Your Data;
// liveworkspace/docs/specs/003-accounts/data-export.md "Settings"): one card saying what a download holds and which
// apps it covers, then the person's own export and each team's they run, in its state. Read when the category is
// first shown, and again every few seconds while one is being made, never otherwise. Signed in only: the panel draws
// it on liveworkspace.app for an account alone (SiteSettingsDialog).
export function DataExportPanel() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refusal = useMemo(() => refusalOnArrival(), []);

  const refresh = useCallback(async () => setLoad(loadOf(await read())), []);

  useEffect(() => {
    let live = true;
    void read().then((result) => {
      if (live) setLoad(loadOf(result));
    });
    return () => {
      live = false;
    };
  }, []);

  // While one is being made, ask again in a few seconds; nothing runs once none is.
  const polling = load.state === 'ready' && running(load.data);
  useEffect(() => {
    if (!polling) return;
    const timer = setTimeout(() => void refresh(), EXPORT_POLL_MS);
    return () => clearTimeout(timer);
  }, [polling, load, refresh]);

  const start = async (key: string) => {
    setBusy(key);
    setErrors((current) => ({ ...current, [key]: '' }));
    const result = await accountApi<{ export: ExportView }>(
      PATH,
      'POST',
      key === PERSONAL ? {} : { team: key },
    );
    if (result.ok) {
      const view = result.data.export;
      setLoad((current) =>
        current.state === 'ready'
          ? {
              ...current,
              data:
                key === PERSONAL
                  ? { ...current.data, personal: view }
                  : {
                      ...current.data,
                      teams: current.data.teams.map((t) =>
                        t.id === key ? { ...t, export: view } : t,
                      ),
                    },
            }
          : current,
      );
    } else {
      setErrors((current) => ({
        ...current,
        [key]: startError(result.error) || errorMessage(result.error),
      }));
    }
    setBusy(null);
  };

  return (
    <div data-data-export-panel="" className="flex flex-col">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-sm shadow-slate-900/20 dark:from-slate-500 dark:to-slate-700"
        >
          <SettingsSharedGlyph id="data" />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <h4 className="text-[15px] font-semibold text-slate-900 dark:text-white">
            Take Everything With You
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            One zip of everything you own: each diagram, plan, document and design as its own file
            with a picture of each tab, boards and sheets as CSV, the comments you wrote, your
            profile and the images you uploaded. We build it in the background and email you a link.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>From</span>
            <EveryAppName />
          </div>
          {refusal ? (
            <p
              role="status"
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              {refusal}
            </p>
          ) : null}
        </div>
      </div>

      {load.state === 'loading' ? (
        <div aria-busy className="border-t border-slate-100 dark:border-slate-700/70">
          <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
            <div className="size-10 shrink-0 animate-pulse rounded-xl bg-slate-200/80 motion-reduce:animate-none dark:bg-slate-700/60" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <div className="h-3.5 w-40 animate-pulse rounded bg-slate-200/80 motion-reduce:animate-none dark:bg-slate-700/60" />
              <div className="h-3 w-64 max-w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-700/40" />
            </div>
          </div>
        </div>
      ) : null}

      {load.state === 'error' ? (
        <div className="border-t border-slate-100 px-4 pb-4 sm:px-5 dark:border-slate-700/70">
          <ErrorNote>
            {load.error === 'export_unavailable'
              ? startError(load.error)
              : errorMessage(load.error)}
          </ErrorNote>
          <button
            type="button"
            className={`${BUTTON.secondary} mt-3`}
            onClick={() => {
              setLoad({ state: 'loading' });
              void refresh();
            }}
          >
            Try Again
          </button>
        </div>
      ) : null}

      {load.state === 'ready' ? (
        <>
          <div className="border-t border-slate-100 dark:border-slate-700/70">
            <ExportRow
              kind="personal"
              title="Everything You Own"
              view={load.data.personal}
              now={load.at}
              busy={busy === PERSONAL}
              error={errors[PERSONAL] || null}
              onStart={() => void start(PERSONAL)}
            />
          </div>
          {load.data.teams.length > 0 ? (
            <section
              aria-labelledby="data-export-teams"
              className="border-t border-slate-100 dark:border-slate-700/70"
            >
              <h5
                id="data-export-teams"
                className="px-4 pt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:px-5 dark:text-slate-400"
              >
                Your Teams
              </h5>
              <p className="px-4 pt-1 text-xs text-slate-500 sm:px-5 dark:text-slate-400">
                Everything each team you run owns, and every comment in it. Each member’s own
                download holds their images.
              </p>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {load.data.teams.map((team) => (
                  <li key={team.id}>
                    <ExportRow
                      kind="team"
                      title={team.name}
                      view={team.export}
                      now={load.at}
                      busy={busy === team.id}
                      error={errors[team.id] || null}
                      onStart={() => void start(team.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
