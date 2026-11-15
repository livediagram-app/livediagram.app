'use client';

// The footer's History button (docs/specs/006-document/version-history.md "In the editor"): in the bottom bar's
// cluster between Search and Settings, as liveplanner's Automations is, for every role, on a document stored on the
// server once it is up. Labelled from `sm` up like its neighbours, icon-only on a phone. It opens Version History on
// the open tab.
import { Glyph, HoverCard } from '@livedocuments/ui';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { track } from '@/lib/telemetry';
import { openVersionHistory } from '@/lib/version-history-store';

export type HistoryGate = {
  documentId: string | null;
  hydrated: boolean;
  offline: boolean;
  embed: boolean;
  workbench: boolean;
  welcomeOpen: boolean;
  community: boolean;
};

/** Whether the footer offers History (blueprint VH19): a document on the server, up, outside an embed or a workbench
 *  frame, with no welcome open and no Community visitor. */
export function offersHistory(gate: HistoryGate): boolean {
  return (
    gate.documentId !== null &&
    gate.hydrated &&
    !gate.offline &&
    !gate.embed &&
    !gate.workbench &&
    !gate.welcomeOpen &&
    !gate.community
  );
}

/** Opens Version History on the open tab and counts it: the footer button's press. */
export function openHistoryFromFooter(activeTabId: string): void {
  track('Version', 'Opened', 'Footer');
  openVersionHistory(activeTabId);
}

export function HistoryButton({
  onOpen,
  labelled = false,
}: {
  onOpen: () => void;
  labelled?: boolean;
}) {
  return (
    <HoverCard
      title="Version History"
      description="Look back at earlier versions of this tab, and restore one."
    >
      <button
        type="button"
        data-tour-id="version-history"
        onClick={onOpen}
        aria-label="History"
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <HistoryIcon size={14} />
        <ChromeLabel show={labelled}>History</ChromeLabel>
      </button>
    </HoverCard>
  );
}

// A clock face with an arrow turning back round it: going back in time.
export function HistoryIcon({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size} units={16}>
      <path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8" />
      <path d="M2.4 2.3v2.6H5" />
      <path d="M8 5.2V8l1.9 1.3" />
    </Glyph>
  );
}
