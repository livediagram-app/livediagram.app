import { useEffect, useRef } from 'react';
import { Button } from '@liveplanner/ui';

// How an import came across: shown in the Import dialog in place of closing it, once the tab has changed and part
// of the file could not land. Calm by design: one line per thing left out, and the way forward. Announced as a
// status; Done takes focus.
export function ImportReport({
  failures,
  onDone,
}: {
  failures?: { title: string; message: string }[];
  onDone: () => void;
}) {
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    doneRef.current?.focus();
  }, []);

  return (
    <div role="status" data-testid="import-report">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import complete</h3>
      {failures && failures.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {failures.map((f, i) => (
            <li key={`${i}-${f.title}`} data-import-failure="">
              <span className="font-semibold">{f.title}</span> · {f.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 flex justify-end">
        <Button ref={doneRef} variant="primary" size="md" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
