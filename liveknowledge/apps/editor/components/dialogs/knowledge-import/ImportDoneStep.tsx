import { useEffect, useRef } from 'react';
import { Button, Tooltip } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import type { RunImportResult } from '@/lib/knowledge-import/run-import';

/** Failed pages and pictures listed by name before the rest are counted. */
export const DONE_LIST_ROWS = 20;
// The Open button's page name is cut here; the tooltip says it whole.
const OPEN_NAME_MAX = 28;

/** "320 Pages Imported", or "140 of 320 Pages Imported" when some were not. */
export function doneTitle(result: Pick<RunImportResult, 'imported' | 'total'>): string {
  const n = (v: number) => v.toLocaleString('en-GB');
  if (result.imported === result.total) {
    return `${n(result.total)} ${result.total === 1 ? 'Page' : 'Pages'} Imported`;
  }
  return `${n(result.imported)} of ${n(result.total)} Pages Imported`;
}

function NamedList({
  label,
  rows,
}: {
  label: string;
  rows: readonly { name: string; reason: string }[];
}) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, DONE_LIST_ROWS);
  return (
    <section aria-label={label}>
      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">{label}</h4>
      <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
        {shown.map((row, i) => (
          <li key={i} data-import-failure="" className="[overflow-wrap:anywhere]">
            <span className="font-semibold">{row.name}</span> · {row.reason}
          </li>
        ))}
        {rows.length > shown.length ? (
          <li>and {(rows.length - shown.length).toLocaleString('en-GB')} more</li>
        ) : null}
      </ul>
    </section>
  );
}

// How an import went (docs/specs/020-import-export/knowledgebase-import.md "Bounds"): how many pages landed, each
// page and picture that did not by name with why, and Open <first page>. Announced as a status; the way forward
// takes focus.
export function ImportDoneStep({
  result,
  onOpen,
  onDone,
}: {
  result: RunImportResult;
  /** Opens the first imported page. */
  onOpen: (first: { id: string; title: string }) => void;
  onDone: () => void;
}) {
  const forward = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    forward.current?.focus();
  }, []);
  const { first } = result;
  const short =
    first && first.title.length > OPEN_NAME_MAX
      ? `${first.title.slice(0, OPEN_NAME_MAX - 1).trimEnd()}…`
      : first?.title;

  return (
    <div className="flex min-h-[28rem] flex-col" role="status" data-testid="knowledge-import-done">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {doneTitle(result)}
      </h3>
      <div className="mt-3 space-y-4">
        {result.stalled ? (
          <Callout tone="warning" title="Saving Stopped Answering">
            The import stopped so nothing is lost. Pages already imported stay, and any still saving
            finish when the connection is back. Import the rest again then.
          </Callout>
        ) : result.cancelled ? (
          <Callout tone="info" title="Import Cancelled">
            The pages already imported stay where they are.
          </Callout>
        ) : null}
        <NamedList
          label="Pages Not Imported"
          rows={result.failedPages.map((p) => ({ name: p.title, reason: p.reason }))}
        />
        <NamedList
          label="Pictures Not Imported"
          rows={result.failedPictures.map((p) => ({
            name: p.picture,
            reason: `${p.reason} ${p.page} keeps its description.`,
          }))}
        />
      </div>
      <div className="mt-auto flex justify-end gap-2 pt-4">
        {first ? (
          <>
            <Button variant="secondary" size="md" onClick={onDone}>
              Done
            </Button>
            <Tooltip label={`Open ${first.title}`}>
              <Button
                ref={forward}
                variant="primary"
                size="md"
                aria-label={`Open ${first.title}`}
                onClick={() => onOpen(first)}
              >
                {`Open ${short}`}
              </Button>
            </Tooltip>
          </>
        ) : (
          <Button ref={forward} variant="primary" size="md" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
