import { Button } from '@liveknowledge/ui';
import type { ImportProgress } from '@/lib/knowledge-import/write-plan';

/** "Importing 140 of 320 Pages". */
export const progressLine = ({ done, total }: ImportProgress): string =>
  `Importing ${done.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} ${total === 1 ? 'Page' : 'Pages'}`;

// An import under way (docs/specs/020-import-export/knowledgebase-import.md "Bounds"): how far it is, as a bar that
// moves a batch at a time, and Cancel, which stops it at the next batch and keeps what was imported.
export function ImportProgressStep({
  progress,
  stopping,
  onCancel,
}: {
  progress: ImportProgress;
  stopping: boolean;
  onCancel: () => void;
}) {
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const line = progressLine(progress);
  return (
    <div className="flex min-h-[28rem] flex-col">
      <div className="flex flex-1 flex-col justify-center">
        {/* The bar says the number to a screen reader as it moves; the line is not announced again each batch. */}
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{line}</p>
        <div
          role="progressbar"
          aria-label="Importing Pages"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-valuetext={line}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        >
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-short"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
          {stopping
            ? 'Stopping after the pages being saved now. Pages already imported stay.'
            : 'Keep this window open. Cancel stops after the pages being saved now, and pages already imported stay.'}
        </p>
      </div>
      <div className="mt-auto flex justify-end pt-4">
        <Button variant="secondary" size="md" busy={stopping} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
