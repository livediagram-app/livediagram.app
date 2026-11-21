'use client';

import { useMemo } from 'react';
import { useItemToolsRows } from '@liveworkspace/workbench/components/chrome/useItemToolsRows';
import { useHistorySnapshotsHost } from '@liveworkspace/snapshots/ui';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { getSessionSharePassword } from '@/lib/api-client';
import { itemHref, useTokenTeams } from '@/lib/explorer-host';

// History for the open item in the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md), mounted
// with the editor so it is there before the Explorer panel ever opens. Signed out, it shows and asks for a sign-in;
// signed in, it is offered for an item not opened by a share link. The plan's connections are a tab of its
// Automations screen (docs/specs/026-plan/automations.md "Outgoing actions").
export function ItemToolsHost({
  currentProjectId,
  currentShareCode,
}: {
  currentProjectId: string | null | undefined;
  currentShareCode: string | null | undefined;
}) {
  const { isSignedIn, accountUserId } = useAccountBootstrap();
  // Offline, the row asks for a sync first (footer-tools-menu.md "Always there"), with Share's Sync move.
  const { syncToCloud, selfParticipant } = useEditorContext();
  const isOffline = useIsOfflineProject(currentProjectId ?? null);
  const ready = selfParticipant.id !== 'self';
  const offline = useMemo(
    () => (currentProjectId && isOffline ? { sync: syncToCloud, ready } : null),
    [currentProjectId, isOffline, syncToCloud, ready],
  );
  // Snapshots live inside History (owner, 2026-11-17): Take Snapshot over its timeline, each one pinned on it.
  const snapshots = useHistorySnapshotsHost();
  return useItemToolsRows({
    snapshots,
    app: 'liveplanner',
    signedIn: !!isSignedIn,
    offline,
    history:
      currentProjectId && !currentShareCode
        ? {
            app: 'liveplanner',
            client: indexClient,
            itemHref,
            viewerId: accountUserId ?? null,
            itemId: currentProjectId,
            shareCode: null,
            sharePassword: getSessionSharePassword,
            useTeams: useTokenTeams,
          }
        : null,
  });
}
