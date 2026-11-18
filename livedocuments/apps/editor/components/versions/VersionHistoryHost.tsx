'use client';

// Where Version History is drawn (docs/specs/006-document/version-history.md "In the editor"): nothing until the
// header's History opens it, then the panel, its code fetched on that first open. It reads the editor's chrome store
// one slice at a time, so a typing commit renders it only when the tab it shows changed.
import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import { withStableEventProps } from '@liveworkspace/workbench/components/primitives/withStableEventProps';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import {
  closeVersionHistory,
  showVersionsOf,
  useVersionHistoryState,
} from '@/lib/version-history-store';

const VersionHistoryPanel = dynamic(
  () => import('./VersionHistoryPanel').then((m) => m.VersionHistoryPanel),
  { ssr: false },
);

function VersionHistoryHostView({ onSelectTab }: { onSelectTab: (tabId: string) => void }) {
  const open = useVersionHistoryState();
  const documentId = useEditorChrome((s) => s.documentId);
  // Another document closes it.
  useEffect(() => closeVersionHistory, [documentId]);
  if (!open || !documentId) return null;
  return <OpenHost documentId={documentId} tabId={open.tabId} onSelectTab={onSelectTab} />;
}

function OpenHost({
  documentId,
  tabId,
  onSelectTab,
}: {
  documentId: string;
  tabId: string;
  onSelectTab: (tabId: string) => void;
}) {
  const ownerId = useEditorChrome((s) => s.selfParticipant.id);
  const shareCode = useEditorChrome((s) => s.sessionShareCode);
  const canEdit = useEditorChrome((s) => s.can.level === 'edit');
  // A link confined to one tab never makes a tab (tab-scoped-share-links.md).
  const tabScoped = useEditorChrome((s) => s.sessionTabScope !== null);

  const allTabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  // `isOutOfScope` answers from the session's tab scope and changes with it (useTabScope): subscribed, as the tab bar
  // does, since a `chrome.get()` in this memo was kept at its first value by the React Compiler (Work Tracker 946).
  const isOutOfScope = useEditorChrome((s) => s.isOutOfScope);
  const loaded = useEditorChrome((s) => s.loadedTabIds.has(tabId));
  const nowTab = useEditorChrome((s) => s.tabs.find((t) => t.id === tabId) ?? null);
  const tabs = useMemo(
    () => allTabs.filter((t) => !isOutOfScope(t.id)).map((t) => ({ id: t.id, name: t.name })),
    [allTabs, isOutOfScope],
  );
  const who = useMemo(() => ({ ownerId, shareCode }), [ownerId, shareCode]);
  // The tab went (deleted by someone): the panel closes with it.
  const gone = !allTabs.some((t) => t.id === tabId);
  useEffect(() => {
    if (gone) closeVersionHistory();
  }, [gone]);
  if (gone) return null;
  return (
    <VersionHistoryPanel
      key={tabId}
      documentId={documentId}
      who={who}
      tabs={tabs}
      tabId={tabId}
      nowTab={loaded ? nowTab : null}
      canEdit={canEdit}
      canCopy={canEdit && !tabScoped}
      onShowTab={(id) => {
        onSelectTab(id);
        showVersionsOf(id);
      }}
      onClose={closeVersionHistory}
    />
  );
}

export const VersionHistoryHost = withStableEventProps(VersionHistoryHostView);
