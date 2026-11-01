'use client';

import { exportProgress, type ExportView } from '@liveworkspace/data-export';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideDownload, lucideMail, lucideUser, lucideUsers } from '@liveworkspace/icons/lucide';
import { BUTTON } from '../account-ui';
import { leftOutLine, phaseLine, readyLine, rowStateOf, type RowState } from './data-export-copy';

const DownloadGlyph = /* @__PURE__ */ lucideGlyph(lucideDownload, 15);
const MailGlyph = /* @__PURE__ */ lucideGlyph(lucideMail, 13);
const PersonGlyph = /* @__PURE__ */ lucideGlyph(lucideUser, 18);
const TeamGlyph = /* @__PURE__ */ lucideGlyph(lucideUsers, 18);

const NOTE = {
  amber:
    'mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  rose: 'mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] leading-relaxed text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
};

/**
 * One export's row in Settings › Your Data: the person's own or a team's, in its state. None and lapsed offer to
 * make one; running shows how far it has got and that an email follows; ready shows its size and dates with Download
 * and Make a New One; failed says so with Try Again.
 */
export function ExportRow({
  kind,
  title,
  view,
  now,
  busy,
  error,
  onStart,
}: {
  kind: 'personal' | 'team';
  title: string;
  view: ExportView | null;
  now: number;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const state: RowState = rowStateOf(view, now);
  const startLabel = kind === 'personal' ? 'Download All My Data' : 'Download Team Data';
  const progress = view && state === 'running' ? Math.round(exportProgress(view) * 100) : 0;
  const notes = view && state === 'ready' ? leftOutLine(view) : null;

  return (
    <div
      data-export-row={kind}
      data-export-state={state}
      className="flex flex-wrap items-start gap-x-3 gap-y-3 px-4 py-4 sm:px-5"
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-200"
      >
        {kind === 'personal' ? <PersonGlyph /> : <TeamGlyph />}
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{title}</p>
        <p
          aria-live="polite"
          className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
        >
          {state === 'none' && 'Not downloaded yet.'}
          {state === 'running' && view && phaseLine(view)}
          {state === 'ready' && view && readyLine(view)}
          {state === 'failed' && 'The last download didn’t finish.'}
          {state === 'expired' && 'The last download’s link has lapsed.'}
        </p>
        {state === 'running' ? (
          <>
            <div
              role="progressbar"
              aria-label={`${title}: download progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="mt-2.5 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60"
            >
              <div
                className="h-full rounded-full bg-slate-800 transition-[width] duration-500 ease-out motion-reduce:transition-none dark:bg-slate-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MailGlyph />
              We’ll email you a link when it’s ready. You can close Settings.
            </p>
          </>
        ) : null}
        {notes ? <p className={NOTE.amber}>{notes}</p> : null}
        {state === 'failed' ? (
          <p className={NOTE.rose}>
            Something went wrong while it was being made. Nothing of yours has changed.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className={NOTE.rose}>
            {error}
          </p>
        ) : null}
      </div>
      {state !== 'running' ? (
        <div className="ml-[52px] flex flex-wrap items-center gap-2 sm:ml-0">
          {state === 'ready' && view?.downloadUrl ? (
            <>
              <a href={view.downloadUrl} className={`${BUTTON.primary} gap-1.5`} download>
                <DownloadGlyph />
                Download
              </a>
              <button type="button" className={BUTTON.secondary} disabled={busy} onClick={onStart}>
                Make a New One
              </button>
            </>
          ) : (
            <button type="button" className={BUTTON.primary} disabled={busy} onClick={onStart}>
              {state === 'failed' ? 'Try Again' : startLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
