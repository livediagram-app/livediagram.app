'use client';

// The chrome of the editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Presentation and UX", WB34): an **Open in livediagram** link at the tab bar's right end, beside
// Search and Settings, where no docked panel can cover it, that opens the document in a full tab; and,
// once the session has ended unrenewed or revoked, the line at the top centre that says how to edit
// again.
import type { WorkbenchEndReason } from '@livediagram/api-schema';
import { HoverCard } from '@livediagram/ui';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from './chrome-button';
import { OpenExternalIcon } from './EmbedChrome';

export function reconnectLine(workbenchName: string): string {
  return `Reconnect in ${workbenchName} to keep editing.`;
}

// The tab bar's last control; labelled like its neighbours from `sm` up, an icon on a phone.
export function WorkbenchOpenLink({
  documentId,
  labelled,
}: {
  documentId: string;
  labelled: boolean;
}) {
  return (
    <HoverCard title="Open in livediagram" description="Opens this document in a full tab.">
      <a
        href={`/document/${encodeURIComponent(documentId)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in livediagram (opens in a new tab)"
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <OpenExternalIcon />
        <ChromeLabel show={labelled}>Open in livediagram</ChromeLabel>
      </a>
    </HoverCard>
  );
}

export function WorkbenchReconnectLine({
  workbenchName,
  ended,
}: {
  workbenchName: string;
  ended: Exclude<WorkbenchEndReason, 'refused'> | null;
}) {
  const reconnect = ended === 'expired' || ended === 'revoked';
  return (
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
  );
}
