'use client';

// The deleted state (docs/specs/013-workspace/trash.md, "While a project is
// in the Trash"): shown when the open project, or the one a link points at,
// is in the Trash. Someone who may restore it gets Restore right here; a
// share-link visitor only learns that it was deleted. Same card shape as
// ApiErrorPage, so it drops into the same status chrome.
import { explorerHref } from '@/lib/explorer-href';
import { useState } from 'react';
import { Button, TrashIcon, buttonClassName } from '@liveplanner/ui';
import { TRASH_RETENTION_MS, type TrashReason } from '@liveworkspace/index-client';

// A plan in the Trash, as the index says: when it went, and why (deleted, or empty for too long).
export type TrashedPlan = { trashedAt: number; reason: TrashReason | null };

const DAY_MS = 24 * 60 * 60 * 1000;

export function trashedCardHeading(row: Pick<TrashedPlan, 'reason'> | null): {
  label: string;
  title: string;
} {
  return row?.reason === 'empty'
    ? { label: 'In the Trash', title: 'This plan is in the Trash' }
    : { label: 'Deleted', title: 'This plan was deleted' };
}

export function daysLeftLabel(trashedAt: number, now: number): string {
  const days = Math.max(0, Math.ceil((trashedAt + TRASH_RETENTION_MS - now) / DAY_MS));
  if (days === 0) return 'Removed at the next clean-up';
  return days === 1 ? '1 day left' : `${days} days left`;
}

// The deleted card's lead for someone who may restore it, with the days left.
export function trashedCardLead(row: TrashedPlan, now: number): string {
  const where =
    row.reason === 'empty' ? 'It was empty, so it moved to the Trash' : 'It is in the Trash';
  return `${where} (${daysLeftLabel(row.trashedAt, now).toLowerCase()}).`;
}

export function ProjectTrashedCard({
  restorable,
  onRestore,
}: {
  restorable: TrashedPlan | null;
  onRestore: () => Promise<void>;
}) {
  const [restoring, setRestoring] = useState(false);
  const [failed, setFailed] = useState(false);
  // One clock per mount keeps render pure.
  const [now] = useState(() => Date.now());
  const heading = trashedCardHeading(restorable);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <TrashIcon size={26} />
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {heading.label}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
          {heading.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {restorable
            ? `${trashedCardLead(restorable, now)} Restore it to put it back where it was.`
            : 'It is no longer available. If it is restored, this link works again.'}
        </p>
        {failed ? (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400" role="status">
            Could not restore it. Please try again.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {restorable ? (
            <Button
              size="md"
              disabled={restoring}
              onClick={() => {
                setRestoring(true);
                setFailed(false);
                onRestore().catch(() => {
                  setRestoring(false);
                  setFailed(true);
                });
              }}
              className="shadow-sm"
            >
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          ) : null}
          <a
            href={explorerHref()}
            className={buttonClassName({ variant: 'secondary', size: 'md' })}
          >
            Go to Explorer
          </a>
        </div>
      </div>
    </div>
  );
}
