'use client';

import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import { SidebarRow } from './SidebarRow';

// A team library's folder subtree in the sidebar (docs/specs/013-workspace/team-shared-documents.md). Reuses
// the SidebarRow primitive for visual parity with the personal tree,
// but is navigation-only: a click opens the team page at that folder
// (rename / move / delete live on the team page, not here), so there's
// no ellipsis menu and nothing in the personal SelectedNode model to
// highlight. Folder ids are globally unique, so it shares the one
// `expanded` Set with the personal tree.
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
  const hasKids = kids.length > 0;
  const isOpen = expanded.has(folder.id);
  return (
    <>
      <SidebarRow
        icon={<FolderSolidIcon open={isOpen} />}
        label={folder.name}
        selected={false}
        onClick={() => onOpenFolder(folder.id)}
        depth={depth}
        hasChildren={hasKids}
        expanded={isOpen}
        onToggleExpand={hasKids ? () => onToggleExpand(folder.id) : undefined}
      />
      {isOpen
        ? kids.map((k) => (
            <TeamFolderSubtree
              key={k.id}
              folder={k}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onOpenFolder={onOpenFolder}
            />
          ))
        : null}
    </>
  );
}
