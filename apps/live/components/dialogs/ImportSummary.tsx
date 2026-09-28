import { useEffect, useId, useRef } from 'react';
import { Button } from '@livediagram/ui';
import { describeImportImageReport, importImageReportTotal } from '@/lib/import-images';
import {
  describeImportNote,
  importSummaryLine,
  namesLine,
  type ImportReport,
} from '@/lib/import-report';

// The one end-of-import view every importer shares, shown in the Import
// dialog in place of closing once the tab has been replaced
// (docs/specs/020-import-export/drawio-import.md "The import report" +
// docs/specs/020-import-export/import-image-pipeline.md "The report"): what
// arrived, how its images came across, and what changed on the way in.
// Announced as a status; Done takes focus. Part of the dialog body: nothing
// is toasted and nothing outside the dialog moves.
export function ImportSummary({ report, onDone }: { report: ImportReport; onDone: () => void }) {
  const headingId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => doneRef.current?.focus(), []);
  const images =
    report.images && importImageReportTotal(report.images) > 0
      ? describeImportImageReport(report.images)
      : null;

  return (
    <section role="status" aria-labelledby={headingId} data-testid="import-report">
      <h3 id={headingId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Import complete
      </h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{importSummaryLine(report)}</p>
      {images ? (
        <div data-testid="import-report-images" className="mt-3">
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {images.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {images.failures.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {images.failures.map((f) => (
                <li key={f.failure} data-failure={f.failure}>
                  <span className="font-semibold tabular-nums">{f.count}</span> · {f.sentence}
                </li>
              ))}
            </ul>
          ) : null}
          {images.hint ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{images.hint}</p>
          ) : null}
        </div>
      ) : null}
      {report.notes.length > 0 ? (
        <ul data-testid="import-report-notes" className="mt-4 space-y-2">
          {report.notes.map((note) => {
            const names = namesLine(note);
            return (
              <li
                key={note.kind}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {describeImportNote(note)}
                {names ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {names}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="mt-5 flex justify-end">
        <Button ref={doneRef} variant="primary" size="md" onClick={onDone}>
          Done
        </Button>
      </div>
    </section>
  );
}
