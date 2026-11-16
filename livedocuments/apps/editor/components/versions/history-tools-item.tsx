'use client';

// The footer's History row (docs/specs/006-document/version-history.md "In the editor"): in the bottom bar's More
// menu, for every role, on a document stored on the server once it is up. It opens Version History on the open tab.
import { Glyph } from '@livedocuments/ui';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
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

/** The History row in the footer's Tools menu (liveworkspace/docs/specs/004-index/footer-tools-menu.md). */
export function historyToolsItem(onOpen: () => void): ChromeToolsItem {
  return { id: 'history', group: 'versions', label: 'Version History',
    description: 'Earlier versions of this tab, to restore.', icon: <HistoryIcon size={16} />, onSelect: onOpen };
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
