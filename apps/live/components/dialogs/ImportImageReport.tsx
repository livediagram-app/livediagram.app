import { useEffect, useRef } from 'react';
import { Button } from '@livediagram/ui';
import { describeImportImageReport, type ImportImageReport as Report } from '@/lib/import-images';

// How an import's images came across (docs/specs/020-import-export/import-image-pipeline.md
// "The report"): shown in the Import dialog in place of closing it, once the
// tab has been replaced. Calm by design: counts, one sentence per failure that
// happened, and the way forward. Announced as a status; Done takes focus.
export function ImportImageReport({ report, onDone }: { report: Report; onDone: () => void }) {
  const doneRef = useRef<HTMLButtonElement>(null);
  const { lines, failures, hint } = describeImportImageReport(report);

  useEffect(() => {
    doneRef.current?.focus();
  }, []);

  return (
    <div role="status" data-testid="import-image-report">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import complete</h3>
      <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {failures.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {failures.map((f) => (
            <li key={f.failure} data-failure={f.failure}>
              <span className="font-semibold tabular-nums">{f.count}</span> · {f.sentence}
            </li>
          ))}
        </ul>
      ) : null}
      {hint ? <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">{hint}</p> : null}
      <div className="mt-5 flex justify-end">
        <Button ref={doneRef} variant="primary" size="md" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
