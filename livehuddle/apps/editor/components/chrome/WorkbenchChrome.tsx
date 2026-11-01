'use client';

// The chrome of the editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Presentation and UX", WB34, WB59): an **Open in livediagram** link at the tab bar's right end, beside
// Search and Settings, where no docked panel can cover it, that opens the document (or, in a workspace frame's
// Explorer, the view) in a full tab; a workspace frame's **Back** at the canvas's top left, to where the
// document was opened from; and, once the session has ended unrenewed or revoked, the line at the top centre that
// says how to edit again.
import type { WorkbenchEndReason } from '@livediagram/api-schema';
import { lucideArrowLeft } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph } from '@livediagram/ui';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { OpenExternalIcon } from './EmbedChrome';
import { TOOLBAR_CONTROL_REST } from './toolbar-surface';
import { ToolbarMenuCard } from './ToolbarMenuCard';

function reconnectLine(workbenchName: string): string {
  return `Reconnect in ${workbenchName} to keep editing.`;
}

const BackGlyph = lucideGlyph(lucideArrowLeft, 18);

// `href`: the app's own address for what the frame shows (`/document/<id>`, or an Explorer view's).
export function WorkbenchOpenLink({
  href,
  labelled,
  description = 'Opens this canvas in a full tab.',
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

// A workspace frame's Back (WB59): the card at the canvas's top left, where the app's Explorer menu button sits,
// level with the palette strip, which keeps clear of it; the first of the canvas's controls and the editor's Header
// region for F6. Labelled from `sm` up; the glyph alone on a phone and `inline` in the strip's row.
export function WorkbenchBackButton({
  onBack,
  backTitle,
  inline = false,
}: {
  onBack: () => void;
  backTitle: string;
  inline?: boolean;
}) {
  return (
    <ToolbarMenuCard inline={inline} region="header">
      <HoverCard title="Back" description={`Back to ${backTitle}.`}>
        <button
          type="button"
          onClick={onBack}
          aria-label={`Back to ${backTitle}`}
          className={`flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md transition sm:px-2 ${TOOLBAR_CONTROL_REST}`}
        >
          <BackGlyph />
          {inline ? null : (
            <span className="hidden text-[13px] font-medium leading-none sm:inline">Back</span>
          )}
        </button>
      </HoverCard>
    </ToolbarMenuCard>
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
