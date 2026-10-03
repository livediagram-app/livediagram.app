'use client';

import { InviteIcon, MyDocumentsIcon, PlusIcon } from '@/components/primitives/explorer-icons';
import { useExplorer } from '../ExplorerContext';
import { SYNTHETIC_FOLDERS } from '../synthetic-folders';
import {
  MY_DOCUMENTS_EXPAND_KEY,
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

// Spaces (docs/specs/013-workspace/explorer-structure.md): My documents and each team as
// root folders, then Invites and New team, or the guest's sign-in nudge.
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
    unsortedDocuments,
    generatedDocuments,
    invites,
    setTeamModalOpen,
    setMobileNavOpen,
  } = useExplorer();
  const has = (row: SidebarRowKind) => rows.includes(row);
  return (
    <SidebarGroup
      id="spaces"
      divider={divider}
      first={first}
      after={has('signInNudge') ? <SidebarSignInNudge /> : null}
    >
      <SidebarRow
        icon={<MyDocumentsIcon />}
        label={SIDEBAR_LABELS.myDocuments}
        textLabel={SIDEBAR_LABELS.myDocuments}
        selected={selected.kind === 'all'}
        onActivate={() => {
          trackSidebar('MyDocuments');
          go({ kind: 'all' });
        }}
        depth={0}
        expandable
        expanded={expanded.has(MY_DOCUMENTS_EXPAND_KEY)}
        onToggleExpand={() => toggleExpand(MY_DOCUMENTS_EXPAND_KEY)}
      >
        {/* Unsorted and Generated lead, as they did under Dynamic: the same views. */}
        {(
          [
            ['unsorted', 'Unsorted', unsortedDocuments.length],
            ['generated', 'Generated', generatedDocuments.length],
          ] as const
        ).map(([kind, row, count]) => {
          const { Icon, label } = SYNTHETIC_FOLDERS[kind];
          return (
            <SidebarRow
              key={kind}
              icon={<Icon />}
              label={label}
              textLabel={label}
              selected={selected.kind === kind}
              onActivate={() => {
                trackSidebar(row);
                go({ kind });
              }}
              depth={1}
              badge={count || undefined}
            />
          );
        })}
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
          onActivate={() => {
            trackSidebar('NewTeam');
            setTeamModalOpen(true);
            setMobileNavOpen(false);
          }}
          depth={0}
        />
      ) : null}
    </SidebarGroup>
  );
}
