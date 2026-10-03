'use client';

import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import { SidebarRow } from './SidebarRow';
import { trackSidebar } from './sidebar-telemetry';
import { useDefaultFolderDescription } from '@/components/placement/DefaultFolderMarker';
import { FolderLabel } from './SidebarFolderSubtree';

// A team folder row and its subfolders (docs/specs/013-workspace/team-shared-documents.md).
// Navigation only: a click opens the team page at that folder (rename / move
// / delete live there), so there's no menu and no highlight. Folder ids are
// globally unique, so it shares the one `expanded` set with the personal tree.
export type TeamFolderNode = { id: string; name: string; parentId: string | null };

export function TeamFolderSubtree({
  folder,
  depth,
  childrenByParent,
  expanded,
  onToggleExpand,
  onOpenFolder,
}: {
  folder: TeamFolderNode;
  depth: number;
  childrenByParent: Map<string | null, TeamFolderNode[]>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onOpenFolder: (folderId: string) => void;
}) {
  const kids = childrenByParent.get(folder.id) ?? [];
  const isOpen = expanded.has(folder.id);
  const markerWords = useDefaultFolderDescription(folder.id);
  return (
    <SidebarRow
      icon={<FolderSolidIcon open={isOpen} />}
      label={<FolderLabel folderId={folder.id} name={folder.name} />}
      textLabel={folder.name}
      description={markerWords || undefined}
      selected={false}
      onActivate={() => {
        trackSidebar('TeamFolder');
        onOpenFolder(folder.id);
      }}
      depth={depth}
      expandable={kids.length > 0}
      expanded={isOpen}
      onToggleExpand={() => onToggleExpand(folder.id)}
    >
      {kids.map((k) => (
        <TeamFolderSubtree
          key={k.id}
          folder={k}
          depth={depth + 1}
          childrenByParent={childrenByParent}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onOpenFolder={onOpenFolder}
        />
      ))}
    </SidebarRow>
  );
}
