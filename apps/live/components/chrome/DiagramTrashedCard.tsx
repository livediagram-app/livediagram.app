'use client';

// The deleted state (docs/specs/013-workspace/trash.md, "While a diagram is
// in the Trash"): shown when the open diagram, or the one a link points at,
// is in the Trash. Someone who may restore it gets Restore right here; a
// share-link visitor only learns that it was deleted. Same card shape as
// ApiErrorPage, so it drops into the same status chrome.
import { useState } from 'react';
import { Button, TrashIcon, buttonClassName } from '@livediagram/ui';
import { EMPTY_DIAGRAM_STALE_DAYS, type TrashedDiagram } from '@livediagram/api-schema';
import { daysLeftLabel } from '@/lib/trash-groups';

// One the empty clean-up moved says why
// (docs/specs/013-workspace/empty-diagram-cleanup.md "In the Trash").
const EMPTIED_LEAD = `It was empty for ${EMPTY_DIAGRAM_STALE_DAYS} days, so it moved to the Trash`;

export function DiagramTrashedCard({
  restorable,
  onRestore,
}: {
  restorable: TrashedDiagram | null;
  onRestore: () => Promise<void>;
}) {
  const [restoring, setRestoring] = useState(false);
  const [failed, setFailed] = useState(false);
  // One clock per mount keeps render pure.
  const [now] = useState(() => Date.now());

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
          Deleted
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
          This diagram was deleted
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {restorable
            ? `${restorable.reason === 'empty' ? EMPTIED_LEAD : 'It is in the Trash'} (${daysLeftLabel(restorable.trashedAt, now).toLowerCase()}). Restore it to put it back where it was.`
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
          <a href="/explorer" className={buttonClassName({ variant: 'secondary', size: 'md' })}>
            Go to Explorer
          </a>
        </div>
      </div>
    </div>
  );
}
