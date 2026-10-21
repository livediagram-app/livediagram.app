'use client';

// The chrome of the editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Presentation and UX", WB34, WB59): an **Open in livediagram** link at the tab bar's right end, beside
// Search and Settings, where no docked panel can cover it, that opens the document (or, in a workspace frame's
// Explorer, the view) in a full tab; the frame's slim top bar, which holds the Explorer's lens field, or a
// document's **Back** alone at the frame's top left, to where the document was opened from; and, once the session
// has ended unrenewed or revoked, the line at the top centre that says how to edit again.
import type { ReactNode } from 'react';
import type { WorkbenchEndReason } from '@livediagram/api-schema';
import { lucideArrowLeft } from '@livediagram/icons/lucide';
import { HoverCard, lucideGlyph } from '@livediagram/ui';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from './chrome-button';
import { OpenExternalIcon } from './EmbedChrome';
import type { WorkspaceFrameHooks } from '@/components/providers/workbench-session-context';

function reconnectLine(workbenchName: string): string {
  return `Reconnect in ${workbenchName} to keep editing.`;
}

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
    <HoverCard title="Open in livediagram" description={description}>
      <a
        href={href}
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

// A workspace frame's way back from a document; labelled from `sm` up, an icon on a phone.
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

// A workspace frame's slim top bar (WB61), in the header's colours, where the app header would be. `region`: the
// editor's F6 region it stands for (hooks/ui/useRegionCycle.ts), on a document.
export function WorkbenchFrameBar({
  children,
  region,
}: {
  children: ReactNode;
  region?: 'header';
}) {
  return (
    <div
      data-region={region}
      className="sticky top-0 z-[var(--z-chrome)] flex h-12 shrink-0 items-center border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/85"
    >
      {children}
    </div>
  );
}

// A document's top bar in a workspace frame (WB59): Back alone, the first thing at the frame's top left, above the
// canvas and so clear of its toolbar, and the editor's Header region for F6.
export function WorkbenchDocumentBar({
  frame,
}: {
  frame: Pick<WorkspaceFrameHooks, 'back' | 'backTitle'>;
}) {
  return (
    <WorkbenchFrameBar region="header">
      <WorkbenchBackButton onBack={frame.back} backTitle={frame.backTitle} labelled />
    </WorkbenchFrameBar>
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
