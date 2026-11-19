'use client';

import { useCallback, useMemo } from 'react';
import { requestMoveCurrent } from '@liveworkspace/explorer/move-current-request';
import { useLatest } from '../../hooks/ui/useLatest';
import type { VisibilityActions } from './share-states';

export type { VisibilityActions };

/**
 * The Share legend's stops beyond Offline and Shared (EditorCornerActions' `visibilityActions`, owner 2026-11-19),
 * the same in every editor: Private syncs an offline item (or, from a team, moves it back out; from a link or the
 * Community, opens Share where those end), Team opens the Explorer panel's Change Folder on it with the person's
 * spaces and teams, and Everyone opens Share on its Community tab. Only for someone who may manage the item (`manage`:
 * its owner or a joined team member, not through a link or as a Community visitor); an offline item offers Sync alone,
 * since a team or the Community needs it on the server. The object and its callbacks are stable, so a memoised header
 * keeps its skip.
 */
export function useVisibilityActions({
  manage,
  offline,
  team,
  community,
  sync,
  openShare,
  openCommunity,
}: {
  manage: boolean;
  offline: boolean;
  team: boolean;
  community: boolean;
  // Sync's conversion for the open item; absent where the person can't sync (no account).
  sync?: (() => void) | undefined;
  openShare: () => void;
  // Share on its Community tab; absent where the app has none.
  openCommunity?: (() => void) | undefined;
}): VisibilityActions | undefined {
  const latest = useLatest({ team, community, sync, openShare, openCommunity });
  const toPrivate = useCallback(() => {
    const now = latest.current;
    if (now.sync && offline) now.sync();
    else if (now.team) requestMoveCurrent();
    else if (now.community && now.openCommunity) now.openCommunity();
    else now.openShare();
  }, [latest, offline]);
  const toCommunity = useCallback(() => latest.current.openCommunity?.(), [latest]);
  const hasSync = Boolean(sync);
  const hasCommunity = Boolean(openCommunity);
  return useMemo<VisibilityActions | undefined>(() => {
    if (!manage) return undefined;
    if (offline) return hasSync ? { private: toPrivate } : undefined;
    return {
      private: toPrivate,
      team: requestMoveCurrent,
      // A team's item is the team's, never one person's to post (the Community tab isn't offered there).
      ...(hasCommunity && !team ? { community: toCommunity } : {}),
    };
  }, [manage, offline, hasSync, hasCommunity, team, toPrivate, toCommunity]);
}
