'use client';

// A kit's run, in place of the setup (liveworkspace/docs/specs/010-site/site.md "Start a Project"): a row per part
// (spinning while the index works, then made with Open, or not made), a row for the connections, and what to do next:
// Open Folder and Start Another once ready; Retry and Remove What Was Made when partly made, Remove asking once in
// place; Try Again alone when nothing was made. The outcome is read out politely.
import type { ReactNode } from 'react';
import type { Kit, KitRun, Level } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import { explorerPath } from '@liveworkspace/explorer';
import { ACCOUNT_BUTTON as BUTTON } from '@liveworkspace/settings-ui';
import { lucideGlyph, Spinner } from '@liveworkspace/ui';
import { lucideCheck, lucideLink, lucideX } from '@liveworkspace/icons/lucide';
import { appItemHref } from '@/lib/explorer/host';
import { appName, connectionsLine, OUTCOME_TITLES, runOutcome } from './kit-words';
import type { KitPhase } from './useKitRun';

const CheckGlyph = lucideGlyph(lucideCheck, 14);
const CrossGlyph = lucideGlyph(lucideX, 14);
const LinkGlyph = lucideGlyph(lucideLink, 16);

type RowState = 'busy' | 'made' | 'failed';

function StateMark({ state }: { state: RowState }) {
  if (state === 'busy')
    return (
      <span className="text-slate-500 dark:text-slate-400">
        <Spinner size={16} />
      </span>
    );
  return state === 'made' ? (
    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950">
      <CheckGlyph />
    </span>
  ) : (
    <span className="flex size-5 items-center justify-center rounded-full bg-red-600 text-white dark:bg-red-500 dark:text-slate-950">
      <CrossGlyph />
    </span>
  );
}

function Row({
  icon,
  title,
  detail,
  state,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  state: RowState;
  action?: ReactNode;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-slate-900 dark:text-white">{title}</span>
        <span
          className={`truncate text-xs ${state === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {detail}
        </span>
      </span>
      {action}
      <span aria-hidden className="flex w-5 justify-center">
        <StateMark state={state} />
      </span>
    </li>
  );
}

export function KitRunCard({
  kit,
  project,
  level,
  phase,
  error,
  onRetry,
  onAskRemove,
  onCancelRemove,
  onRemove,
  onReset,
}: {
  kit: Kit;
  project: string;
  level: Level;
  phase: Exclude<KitPhase, { kind: 'setup' }>;
  error: string | null;
  onRetry: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
  onReset: () => void;
}) {
  const running = phase.kind === 'running';
  // While running, a retry's earlier parts stand as made; everything else spins.
  const run = running ? null : phase.run;
  const earlier = running ? phase.run : null;
  const outcome = run ? runOutcome(run) : null;
  const connections = connectionsLine(kit, level, run);
  const itemOf = (slot: string) =>
    (run ?? earlier)?.parts.find((p) => p.slot === slot)?.itemId ?? null;
  return (
    <section
      aria-labelledby="kit-run-title"
      aria-busy={running || phase.kind === 'removing'}
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div aria-live="polite">
        <h2
          id="kit-run-title"
          className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          {outcome ? OUTCOME_TITLES[outcome] : `Creating ${project}…`}
        </h2>
      </div>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {kit.parts.map((part) => {
          const id = itemOf(part.slot);
          const state: RowState = id ? 'made' : running ? 'busy' : 'failed';
          return (
            <Row
              key={part.slot}
              icon={<BrandMark app={part.app} className="size-5" />}
              title={`${project} ${part.name}`}
              detail={
                state === 'failed' ? `Couldn’t be made in ${appName(part.app)}` : appName(part.app)
              }
              state={state}
              action={
                state === 'made' && id && !running ? (
                  <a
                    href={appItemHref(part.app, id)}
                    className={`${BUTTON.secondary} relative touch-target-y py-1.5 text-xs`}
                    aria-label={`Open ${project} ${part.name}`}
                  >
                    Open
                  </a>
                ) : null
              }
            />
          );
        })}
        <Row
          icon={<LinkGlyph />}
          title="Connections"
          detail={connections.text}
          state={running ? 'busy' : connections.failed ? 'failed' : 'made'}
        />
      </ul>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {run ? (
        <RunActions
          run={run}
          outcome={outcome!}
          confirming={phase.kind === 'confirming'}
          removing={phase.kind === 'removing'}
          onRetry={onRetry}
          onAskRemove={onAskRemove}
          onCancelRemove={onCancelRemove}
          onRemove={onRemove}
          onReset={onReset}
        />
      ) : null}
    </section>
  );
}

function RunActions({
  run,
  outcome,
  confirming,
  removing,
  onRetry,
  onAskRemove,
  onCancelRemove,
  onRemove,
  onReset,
}: {
  run: KitRun;
  outcome: 'ready' | 'partial' | 'none';
  confirming: boolean;
  removing: boolean;
  onRetry: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
  onReset: () => void;
}) {
  const row = 'mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center';
  const primary = `${BUTTON.primary} relative touch-target-y min-h-11 px-6 py-2.5 text-center`;
  const secondary = `${BUTTON.secondary} relative touch-target-y min-h-11 py-2.5 text-center`;
  if (outcome === 'ready')
    return (
      <div className={row}>
        <a href={explorerPath({ kind: 'folder', id: run.folderId })} className={primary}>
          Open Folder
        </a>
        <button type="button" onClick={onReset} className={secondary}>
          Start Another
        </button>
      </div>
    );
  if (confirming || removing)
    return (
      <div
        role="group"
        aria-label="Delete what was made"
        className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40"
      >
        <p className="text-sm font-medium text-red-900 dark:text-red-200">
          Delete the files this made? This can’t be undone.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className={`${BUTTON.danger} relative touch-target-y min-h-11 px-5 py-2.5`}
          >
            {removing ? 'Deleting…' : 'Delete Them'}
          </button>
          <button type="button" onClick={onCancelRemove} disabled={removing} className={secondary}>
            Cancel
          </button>
        </div>
      </div>
    );
  return (
    <div className={row}>
      <button type="button" onClick={onRetry} className={primary}>
        {outcome === 'none' ? 'Try Again' : 'Retry'}
      </button>
      {outcome === 'partial' ? (
        <button type="button" onClick={onAskRemove} className={secondary}>
          Remove What Was Made
        </button>
      ) : null}
    </div>
  );
}
