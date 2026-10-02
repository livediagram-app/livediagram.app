'use client';

import { useRef } from 'react';
import type { DocumentListItem, SharedWithItem } from '@/lib/api-client';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';
import { sidebarDivider, sidebarGroups } from '@/app/explorer/sidebar/sidebar-structure';
import { useTreeNavigation } from '@/app/explorer/sidebar/useTreeNavigation';
import type { PanelFolder, PanelFolderIndex } from './PanelFolderItem';
import { PanelMoreGroup } from './PanelMoreGroup';
import { PanelOverviewGroup } from './PanelOverviewGroup';
import { PanelSpacesGroup } from './PanelSpacesGroup';
import { PanelTreeProvider, type PanelTree } from './PanelTreeContext';

// The floating Explorer panel's tree (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel):
// the sidebar's three groups, built from the same rows, layout rules and keyboard model, at
// the panel's width. Rows with documents open in place; the others go to the Explorer. The
// tree scrolls inside the panel when it is taller than the room it has.
export function PanelExplorerTree({
  tree,
  busy = false,
  shared,
  ownIndex,
  offlineDocuments,
  teams,
  foldersByTeam,
  documentsByTeam,
}: {
  tree: PanelTree;
  // The document lists are still loading.
  busy?: boolean;
  shared: SharedWithItem[];
  ownIndex: PanelFolderIndex;
  offlineDocuments: DocumentListItem[];
  teams: { id: string; name: string }[];
  foldersByTeam: Map<string, PanelFolder[]>;
  documentsByTeam: Map<string, DocumentListItem[]>;
}) {
  const navRef = useRef<HTMLElement>(null);
  const keyboard = useTreeNavigation(navRef);
  const divider = sidebarDivider(useMinimalChrome());
  const groups = sidebarGroups({
    // Teams exist only for a signed-in reader.
    signedIn: teams.length > 0,
    signInAvailable: false,
    pendingInvites: 0,
    offlineDocuments: offlineDocuments.length,
    selected: null,
    surface: 'panel',
  });
  return (
    <PanelTreeProvider value={tree}>
      <nav
        ref={navRef}
        aria-label="Explorer"
        aria-busy={busy || undefined}
        {...keyboard}
        className="scrollbar-slim max-h-[60vh] overflow-y-auto"
      >
        {groups.map(({ id, rows }, i) => {
          const first = i === 0;
          if (id === 'overview')
            return <PanelOverviewGroup key={id} divider={divider} first={first} shared={shared} />;
          if (id === 'spaces')
            return (
              <PanelSpacesGroup
                key={id}
                rows={rows}
                divider={divider}
                first={first}
                ownIndex={ownIndex}
                teams={teams}
                foldersByTeam={foldersByTeam}
                documentsByTeam={documentsByTeam}
              />
            );
          return (
            <PanelMoreGroup
              key={id}
              rows={rows}
              divider={divider}
              first={first}
              offlineDocuments={offlineDocuments}
            />
          );
        })}
      </nav>
    </PanelTreeProvider>
  );
}
