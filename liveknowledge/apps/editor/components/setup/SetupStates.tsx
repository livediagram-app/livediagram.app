'use client';

// What Describe to Set Up shows in a step's place (docs/specs/030-knowledgebase/describe-to-set-up.md): a structure
// being suggested, the pages being made, and how a run that did not make everything ended. Each takes
// the body's whole room, so the dialog keeps one height.
import { SkeletonRows } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import type { ImportProgress, ImportWriteResult } from '@/lib/knowledge-import/write-plan';

/** While a structure is suggested: the tree's place held by rows of its shape, so nothing jumps when it arrives. */
export function SetupSuggesting() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-setup-step="suggesting">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Reading your description and laying out pages. This takes a few seconds.
      </p>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <SkeletonRows label="Suggesting a Structure" rows={6} lead="none" />
      </div>
    </div>
  );
}

/** While the pages are made: one line and a bar. */
export function SetupCreating({ progress }: { progress: ImportProgress | null }) {
  const done = progress?.done ?? 0;
  const total = progress?.total ?? 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3" data-setup-step="creating">
      <p role="status" className="text-sm font-medium text-slate-900 dark:text-slate-100">
        Making Pages: {done.toLocaleString('en')} of {total.toLocaleString('en')}
      </p>
      <div
        role="progressbar"
        aria-label="Pages Made"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className="h-full origin-left rounded-full bg-brand-600 motion-safe:transition-transform motion-safe:duration-short dark:bg-brand-400"
          style={{ transform: `scaleX(${total > 0 ? done / total : 0})` }}
        />
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Each batch of twenty is saved before the next begins.
      </p>
    </div>
  );
}

/** A run that did not make every page: how many were made, and each page that was not, with why. */
export function SetupDone({ result }: { result: ImportWriteResult }) {
  const made = result.imported;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" data-setup-step="done">
      <Callout
        tone="warning"
        size="md"
        role="alert"
        title={`${made.toLocaleString('en')} of ${result.total.toLocaleString('en')} Pages Were Made`}
      >
        {result.cancelled
          ? 'You stopped before the rest were made. The pages already made stay.'
          : result.stalled
            ? 'Saving stopped answering, so the rest were not made. The pages already made keep saving.'
            : 'The rest could not be made.'}
      </Callout>
      {result.failedPages.length > 0 ? (
        <ul className="rounded-lg border border-slate-200 py-1 text-xs dark:border-slate-700">
          {result.failedPages.slice(0, 30).map((page, at) => (
            <li key={at} className="px-3 py-1 text-slate-700 dark:text-slate-200">
              <span className="font-medium">{page.title}</span>
              <span className="text-slate-600 dark:text-slate-400">: {page.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
