import { useEffect, useId, useRef } from 'react';
import { Button } from '@livediagram/ui';
import {
  describeImportNote,
  importSummaryLine,
  namesLine,
  type ImportReport,
} from '@/lib/import-report';

// What an import changed on the way in (docs/specs/020-import-export/drawio-import.md
// "The import report"): shown in place of the paste panel when the report has
// any line, so nothing degrades silently. Part of the dialog body: nothing is
// toasted and nothing outside the dialog moves. Done takes focus so keyboard
// and screen reader users land on the result.
export function ImportSummary({
  formatTitle,
  report,
  onDone,
}: {
  formatTitle: string;
  report: ImportReport;
  onDone: () => void;
}) {
  const headingId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => doneRef.current?.focus(), []);

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Imported from {formatTitle}
      </h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{importSummaryLine(report)}</p>
      <ul className="mt-4 space-y-2">
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
      <div className="mt-4 flex justify-end">
        <Button ref={doneRef} variant="primary" size="md" onClick={onDone}>
          Done
        </Button>
      </div>
    </section>
  );
}
