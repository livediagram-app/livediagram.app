'use client';

// The header's History action (docs/specs/006-document/version-history.md "In the editor"): first among the right
// edge's actions, for every role, on a document stored on the server once it is up. It opens Version History on the
// open tab. A full-height header action like Share and Copy.
import { Glyph, HoverCard } from '@livedocuments/ui';
import {
  HEADER_ACTION_BTN,
  HEADER_ACTION_TONE,
  HeaderGlyph,
} from '@liveworkspace/workbench/components/chrome/header-action';
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

/** Whether the header offers History (blueprint VH19): a document on the server, up, outside an embed or a workbench
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

export function HistoryHeaderButton({ activeTabId }: { activeTabId: string }) {
  return (
    <HoverCard
      title="Version History"
      description="Look back at earlier versions of this tab, and restore one."
    >
      <button
        type="button"
        data-tour-id="version-history"
        onClick={() => {
          track('Version', 'Opened', 'Header');
          openVersionHistory(activeTabId);
        }}
        className={`${HEADER_ACTION_BTN} ${HEADER_ACTION_TONE}`}
      >
        <HeaderGlyph>
          <HistoryIcon />
        </HeaderGlyph>
        <span>History</span>
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
