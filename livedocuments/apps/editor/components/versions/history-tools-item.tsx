'use client';

// Version History from the footer (docs/specs/006-document/version-history.md "In the editor"): inside Tools' History
// (owner, 2026-11-17), for every role, on a document stored on the server once it is up. It opens Version History on
// the open tab.
import { useCallback } from 'react';
import { Glyph } from '@livedocuments/ui';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { usePublishItemVersions } from '@liveworkspace/workbench/components/chrome/tools-door';
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

/** Offers Version History inside Tools' History while `onOpen` is set (liveworkspace/docs/specs/004-index/
 *  footer-tools-menu.md): History shows Open Version History, or opens it straight away where it has nothing else. */
export function useVersionHistoryInTools(onOpen: (() => void) | undefined): void {
  const latest = useLatest(onOpen);
  const open = useCallback(() => latest.current?.(), [latest]);
  usePublishItemVersions(onOpen ? open : null);
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
