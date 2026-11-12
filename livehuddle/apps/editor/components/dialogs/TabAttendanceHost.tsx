'use client';

import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { apiListAttendance } from '@/lib/api-client';

const TabAttendanceDialog = dynamic(
  () => import('@/components/dialogs/TabAttendanceDialog').then((m) => m.TabAttendanceDialog),
  { ssr: false },
);

// Mounts a tab's Attendance dialog (docs/specs/012-collaboration/tab-attendance.md "Where it shows") for the tab its
// menu named, reading the visits as the session's own identity and share link. Nothing when no tab is asked for, or
// when the tab has gone meanwhile.
export function TabAttendanceHost({
  tabId,
  onClose,
}: {
  tabId: string | null;
  onClose: () => void;
}) {
  const { imageContext, tabs } = useEditorContext();
  const tab = tabId ? tabs.find((t) => t.id === tabId) : undefined;
  const ownerId = imageContext?.ownerId ?? '';
  const documentId = imageContext?.documentId ?? '';
  const shareCode = imageContext?.shareCode ?? null;
  const load = useCallback(
    () => apiListAttendance(ownerId, documentId, tabId ?? '', shareCode),
    [ownerId, documentId, shareCode, tabId],
  );
  if (!tab || !imageContext) return null;
  return <TabAttendanceDialog tabName={tab.name} load={load} onClose={onClose} />;
}
