'use client';

import { useRef } from 'react';
import { clerkEnabled } from '@/lib/clerk-config';
import { isMinimalChrome } from '@/lib/power-user-mode';
import { useExplorer } from '../ExplorerContext';
import { sidebarDivider, sidebarGroups } from './sidebar-structure';
import { useTreeNavigation } from './useTreeNavigation';
import { OverviewGroup } from './OverviewGroup';
import { SpacesGroup } from './SpacesGroup';
import { MoreGroup } from './MoreGroup';

// The Explorer's navigation tree (docs/specs/013-workspace/explorer-structure.md), shared by
// the desktop sidebar and the mobile drawer in ExplorerShell: three groups,
// each an ARIA tree, under one keyboard model on the `nav`. Which rows show is
// sidebarGroups'; whether groups open with titles or hairlines follows
// Minimal chrome. Every navigation goes through `go`, which also closes the
// drawer.
export function ExplorerSidebar() {
  const { teamsEnabled, invites, offlineDocuments, selected, prefs } = useExplorer();
  const navRef = useRef<HTMLElement>(null);
  const keyboard = useTreeNavigation(navRef);
  const divider = sidebarDivider(isMinimalChrome(prefs));
  const groups = sidebarGroups({
    signedIn: teamsEnabled,
    signInAvailable: clerkEnabled,
    pendingInvites: invites.length,
    offlineDocuments: offlineDocuments.length,
    selected: selected.kind,
  });
  return (
    <nav ref={navRef} aria-label="Explorer" {...keyboard}>
      {groups.map(({ id, rows }, i) => {
        const first = i === 0;
        if (id === 'overview') return <OverviewGroup key={id} divider={divider} first={first} />;
        if (id === 'spaces')
          return <SpacesGroup key={id} rows={rows} divider={divider} first={first} />;
        return <MoreGroup key={id} rows={rows} divider={divider} first={first} />;
      })}
    </nav>
  );
}
