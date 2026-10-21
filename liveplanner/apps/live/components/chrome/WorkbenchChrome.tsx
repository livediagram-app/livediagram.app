'use client';

// The chrome of the editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Presentation and UX", WB34, WB59): an **Open in liveplanner** link at the tab bar's right end, beside
// Search and Settings, where no docked panel can cover it, that opens the document (or, in a workspace frame's
// Explorer, the view) in a full tab; a workspace frame's **Back** at the tab bar's left end, to where the
// document was opened from; and, once the session has ended unrenewed or revoked, the line at the top centre that
// says how to edit again.
import type { WorkbenchEndReason } from '@liveplanner/api-schema';
import { lucideArrowLeft } from '@liveplanner/icons/lucide';
import { HoverCard, lucideGlyph } from '@liveplanner/ui';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from './chrome-button';
import { OpenExternalIcon } from './EmbedChrome';

function reconnectLine(workbenchName: string): string {
  return `Reconnect in ${workbenchName} to keep editing.`;
}

// The tab bar's last control; labelled like its neighbours from `sm` up, an icon on a phone.
const BackGlyph = lucideGlyph(lucideArrowLeft, 14);

// `href`: the app's own address for what the frame shows (`/document/<id>`, or an Explorer view's).
export function WorkbenchOpenLink({
  href,
  labelled,
  description = 'Opens this document in a full tab.',
}: {
  href: string;
  labelled: boolean;
  description?: string;
}) {
  return (
    <HoverCard title="Open in liveplanner" description={description}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in liveplanner (opens in a new tab)"
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <OpenExternalIcon />
        <ChromeLabel show={labelled}>Open in liveplanner</ChromeLabel>
      </a>
    </HoverCard>
  );
}

// The tab bar's first control in a workspace frame; labelled like its neighbours from `sm` up, an icon on a phone.
export function WorkbenchBackButton({
  onBack,
  backTitle,
  labelled,
}: {
  onBack: () => void;
  backTitle: string;
  labelled: boolean;
}) {
  return (
    <HoverCard title="Back" description={`Back to ${backTitle}.`}>
      <button
        type="button"
        onClick={onBack}
        aria-label={`Back to ${backTitle}`}
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <BackGlyph />
        <ChromeLabel show={labelled}>Back</ChromeLabel>
      </button>
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
