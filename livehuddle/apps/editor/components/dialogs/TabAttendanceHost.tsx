'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { apiListAttendance } from '@/lib/api-client';
import { liveNamesFrom, liveNamesSignature } from '@/lib/tab-attendance';

const TabAttendanceDialog = dynamic(
  () => import('@/components/dialogs/TabAttendanceDialog').then((m) => m.TabAttendanceDialog),
  { ssr: false },
);

// Mounts a tab's Attendance dialog (docs/specs/012-collaboration/tab-attendance.md "Where it shows") for the tab its
// menu named, reading the visits as the session's own identity and share link. Nothing when no tab is asked for, or
// when the tab has gone meanwhile. The room's roster rides along by collab key, so the open dialog shows a rename or a
// recolour at once (Work Tracker 825).
export function TabAttendanceHost({
  tabId,
  onClose,
}: {
  tabId: string | null;
  onClose: () => void;
}) {
  const { imageContext, tabs, livePresence, selfParticipant } = useEditorContext();
  // Rebuilt only when someone's key, name or colour changes, never for the roster's other churn (a status, a
  // last-seen tick), so the open rows keep their memo.
  const signature = liveNamesSignature(tabId ? [selfParticipant, ...livePresence] : []);
  const live = useMemo(() => liveNamesFrom(signature), [signature]);
  const tab = tabId ? tabs.find((t) => t.id === tabId) : undefined;
  const ownerId = imageContext?.ownerId ?? '';
  const documentId = imageContext?.documentId ?? '';
  const shareCode = imageContext?.shareCode ?? null;
  const load = useCallback(
    () => apiListAttendance(ownerId, documentId, tabId ?? '', shareCode),
    [ownerId, documentId, shareCode, tabId],
  );
  if (!tab || !imageContext) return null;
  return <TabAttendanceDialog tabName={tab.name} load={load} onClose={onClose} live={live} />;
}
