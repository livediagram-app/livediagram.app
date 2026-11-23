'use client';

import { useMemo } from 'react';
import { useAskAi } from './useAskAi';
import { useItemToolsRows } from '@liveworkspace/workbench/components/chrome/useItemToolsRows';
import { useHistorySnapshotsHost } from '@liveworkspace/snapshots/ui';
import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { useIsOfflineDesign } from '@/hooks/persistence/useIsOfflineDesign';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { getSessionSharePassword } from '@/lib/api-client';
import { itemHref, useTokenTeams } from '@/lib/explorer-host';

// History for the open item in the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md), mounted
// with the editor so it is there before the Explorer panel ever opens. Signed out, it shows and asks for a sign-in;
// signed in, it is there for an item not opened by a share link.
export function ItemToolsHost({
  currentDesignId,
  currentShareCode,
}: {
  currentDesignId: string | null | undefined;
  currentShareCode: string | null | undefined;
}) {
  const { isSignedIn, accountUserId } = useAccountBootstrap();
  // Ask AI, for whoever has the design open (signed out, its row asks for a sign-in).
  useAskAi(currentDesignId, isSignedIn ? (accountUserId ?? null) : null);
  // Offline, the row asks for a sync first (footer-tools-menu.md "Always there"), with Share's Sync move.
  const { syncToCloud, selfParticipant } = useEditorContext();
  const isOffline = useIsOfflineDesign(currentDesignId ?? null);
  const ready = selfParticipant.id !== 'self';
  const offline = useMemo(
    () => (currentDesignId && isOffline ? { sync: syncToCloud, ready } : null),
    [currentDesignId, isOffline, syncToCloud, ready],
  );
  // Snapshots live inside History (owner, 2026-11-17): Take Snapshot over its timeline, each one pinned on it.
  const snapshots = useHistorySnapshotsHost();
  return useItemToolsRows({
    snapshots,
    app: 'livedesign',
    signedIn: !!isSignedIn,
    offline,
    history:
      currentDesignId && !currentShareCode
        ? {
            app: 'livedesign',
            client: indexClient,
            itemHref,
            viewerId: accountUserId ?? null,
            itemId: currentDesignId,
            shareCode: null,
            sharePassword: getSessionSharePassword,
            useTeams: useTokenTeams,
          }
        : null,
  });
}
