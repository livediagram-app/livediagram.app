'use client';

import { useMemo } from 'react';
import { useItemToolsRows } from '@liveworkspace/workbench/components/chrome/useItemToolsRows';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { getSessionSharePassword } from '@/lib/api-client';
import { itemHref, useTokenTeams } from '@/lib/explorer-host';

// History and Webhooks for the open item in the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md),
// mounted with the editor so they are there before the Explorer panel ever opens. Signed out, both show and ask for a
// sign-in; signed in, History for an item not opened by a share link, Webhooks for one who may manage them.
export function ItemToolsHost({
  currentProjectId,
  currentShareCode,
  onWebhooks,
}: {
  currentProjectId: string | null | undefined;
  currentShareCode: string | null | undefined;
  onWebhooks?: () => void;
}) {
  const { isSignedIn, accountUserId } = useAccountBootstrap();
  // In This Browser, both rows ask for a sync first (footer-tools-menu.md "Always there"), with Share's Sync move.
  const { syncToCloud, selfParticipant } = useEditorContext();
  const isOffline = useIsOfflineProject(currentProjectId ?? null);
  const ready = selfParticipant.id !== 'self';
  const offline = useMemo(
    () => (currentProjectId && isOffline ? { sync: syncToCloud, ready } : null),
    [currentProjectId, isOffline, syncToCloud, ready],
  );
  return useItemToolsRows({
    app: 'liveplanner',
    signedIn: !!isSignedIn,
    offline,
    onWebhooks,
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
