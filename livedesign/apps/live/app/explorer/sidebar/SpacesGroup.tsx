'use client';

import { InviteIcon, MyDesignsIcon, PlusIcon } from '@/components/primitives/explorer-icons';
import { manageTeamsUrl } from '@/lib/auth-config';
import { useExplorer } from '../ExplorerContext';
import {
  MY_DESIGNS_EXPAND_KEY,
  SIDEBAR_LABELS,
  type SidebarDivider,
  type SidebarRowKind,
} from './sidebar-structure';
import { trackSidebar } from './sidebar-telemetry';
import { SidebarFolderSubtree } from './SidebarFolderSubtree';
import { SidebarGroup } from './SidebarGroup';
import { SidebarRow } from './SidebarRow';
import { SidebarSignInNudge } from './SidebarSignInNudge';
import { TeamRows } from './TeamRows';
import { useMyDesignsMenu } from './useMyDesignsMenu';
import { useExplorerDropTarget } from '../useExplorerDropTarget';

// Spaces (docs/specs/013-workspace/explorer-structure.md): My Work and each team as
// root folders, then Invites and New Team, or the guest's sign-in nudge.
// `rows` (from sidebarGroups) decides which show.
export function SpacesGroup({
  rows,
  divider,
  first,
}: {
  rows: SidebarRowKind[];
  divider: SidebarDivider;
  first: boolean;
}) {
  const {
    selected,
    go,
    rootFolders,
    childrenByParent,
    expanded,
    toggleExpand,
    renamingFolderId,
    commitRenameFolder,
    setRenamingFolderId,
    folderActions,
    invites,
    rootDefaults,
  } = useExplorer();
  const myDesignsMenu = useMyDesignsMenu(rootDefaults, { reveal: true });
  const has = (row: SidebarRowKind) => rows.includes(row);
  // A design dropped here files at the root; resting on it opens or closes the root folders.
  const drop = useExplorerDropTarget(
    { teamId: null, folderId: null },
    {
      onLongHover: rootFolders.length > 0 ? () => toggleExpand(MY_DESIGNS_EXPAND_KEY) : undefined,
    },
  );
  return (
    <SidebarGroup
      id="spaces"
      divider={divider}
      first={first}
      after={has('signInNudge') ? <SidebarSignInNudge /> : null}
    >
      <SidebarRow
        icon={<MyDesignsIcon />}
        tone="sky"
        label={SIDEBAR_LABELS.myDesigns}
        textLabel={SIDEBAR_LABELS.myDesigns}
        selected={selected.kind === 'all'}
        onActivate={() => {
          trackSidebar('MyDesigns');
          go({ kind: 'all' });
        }}
        depth={0}
        expandable={rootFolders.length > 0}
        expanded={expanded.has(MY_DESIGNS_EXPAND_KEY)}
        onToggleExpand={() => toggleExpand(MY_DESIGNS_EXPAND_KEY)}
        onContextMenu={myDesignsMenu.onContextMenu}
        trailing={myDesignsMenu.trailing}
        rowProps={drop.handlers}
        highlighted={drop.isDragOver}
      >
        {rootFolders.map((f) => (
          <SidebarFolderSubtree
            key={f.id}
            folder={f}
            depth={1}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            selected={selected}
            onSelect={(id) => go({ kind: 'folder', id })}
            childrenByParent={childrenByParent}
            renamingFolderId={renamingFolderId}
            onCommitRenameFolder={commitRenameFolder}
            onCancelRenameFolder={() => setRenamingFolderId(null)}
            folderActions={folderActions}
          />
        ))}
      </SidebarRow>
      {has('teams') ? <TeamRows /> : null}
      {has('invites') ? (
        <SidebarRow
          icon={<InviteIcon />}
          tone="rose"
          label={SIDEBAR_LABELS.invites}
          textLabel={SIDEBAR_LABELS.invites}
          selected={selected.kind === 'invites'}
          onActivate={() => {
            trackSidebar('Invites');
            go({ kind: 'invites' });
          }}
          depth={0}
          badge={invites.length || undefined}
        />
      ) : null}
      {has('newTeam') ? (
        <SidebarRow
          icon={<PlusIcon />}
          label={SIDEBAR_LABELS.newTeam}
          textLabel={SIDEBAR_LABELS.newTeam}
          selected={false}
          // Teams are made on liveworkspace.app, the same team in every app
          // (liveworkspace/docs/accounts.md "Teams").
          onActivate={() => {
            trackSidebar('NewTeam');
            window.location.assign(manageTeamsUrl);
          }}
          depth={0}
        />
      ) : null}
    </SidebarGroup>
  );
}
