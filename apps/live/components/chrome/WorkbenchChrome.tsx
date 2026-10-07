'use client';

// The chrome of the editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Presentation and UX", WB34): an **Open in livediagram** link at the top right of the canvas (the
// TabBar holds the bottom, the header is gone) that opens the document in a full tab, and, once the
// session has ended unrenewed or revoked, the line at the top centre that says how to edit again.
import type { WorkbenchEndReason } from '@livediagram/api-schema';
import { OpenExternalIcon } from './EmbedChrome';

export function reconnectLine(workbenchName: string): string {
  return `Reconnect in ${workbenchName} to keep editing.`;
}

export function WorkbenchChrome({
  documentId,
  workbenchName,
  ended,
}: {
  documentId: string;
  workbenchName: string;
  ended: Exclude<WorkbenchEndReason, 'refused'> | null;
}) {
  const reconnect = ended === 'expired' || ended === 'revoked';
  return (
    <>
      <a
        href={`/document/${encodeURIComponent(documentId)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in livediagram (opens in a new tab)"
        className="fixed top-3 right-3 z-[var(--z-chrome)] flex min-h-6 min-w-6 items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-900 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
      >
        <OpenExternalIcon />
        Open in livediagram
      </a>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed top-3 left-1/2 z-[var(--z-chrome)] -translate-x-1/2"
      >
        {reconnect ? (
          <p className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm dark:bg-amber-950 dark:text-amber-100">
            {reconnectLine(workbenchName)}
          </p>
        ) : null}
      </div>
    </>
  );
}
