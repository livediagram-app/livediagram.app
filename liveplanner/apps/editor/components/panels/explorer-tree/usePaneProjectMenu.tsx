'use client';

// The one project menu for any project the editor's Explorer pane shows (docs/specs/013-workspace/
// explorer-structure.md "The pane"): the Explorer page's own ProjectActionsMenu, opened from the row's ⋯, a
// right-click or Shift+F10, with the verbs the host wired. Home's cards, What Happened and the places'
// rows all take it from here, so a project offers the same verbs wherever it appears.
import type { MouseEvent, ReactNode } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { ProjectActionsMenu } from '@/app/explorer/project-row-shared';
import type { PaneProject } from '@/app/explorer/views';
import { usePanelTree } from './PanelTreeContext';

export function usePaneProjectMenu(doc: PaneProject | undefined): {
  onContextMenu?: (e: MouseEvent) => void;
  trailing: ReactNode;
} {
  const tree = usePanelTree();
  const menu = useRowMenu({ disabled: !doc });
  if (!doc) return { trailing: null };
  const name = doc.name || 'Untitled plan';
  const team = doc.team;
  const shareCode = doc.shared?.shareCode;
  const shared = shareCode !== undefined;
  const favourite = tree.favouriteIds?.has(doc.id) === true;
  return {
    onContextMenu: menu.onContextMenu,
    trailing: (
      <>
        <EllipsisTriggerButton {...menu.triggerProps} size="md" reveal label={`Menu for ${name}`} />
        {menu.open ? (
          <ProjectActionsMenu
            project={doc}
            anchor={menu.triggerRef.current}
            ownerId={tree.ownerId}
            onClose={menu.close}
            isOpen={doc.id === tree.currentProjectId}
            onOpen={() => tree.onOpenProject(doc.id, shareCode)}
            onDismiss={
              shared && tree.onDismissShared ? () => tree.onDismissShared?.(doc.id) : undefined
            }
            onDuplicate={
              !shared && tree.onDuplicateProject
                ? () => tree.onDuplicateProject?.(doc.id)
                : undefined
            }
            onMove={
              shared
                ? undefined
                : team
                  ? tree.onMoveTeamProjectRequest
                    ? () => tree.onMoveTeamProjectRequest?.(doc.id, team.id)
                    : undefined
                  : tree.onMoveProjectRequest
                    ? () => tree.onMoveProjectRequest?.(doc.id)
                    : undefined
            }
            onDelete={
              !shared && tree.onDeleteProject
                ? () => tree.onDeleteProject?.(doc.id, menu.triggerRef.current)
                : undefined
            }
            favourite={shared ? undefined : favourite}
            onToggleFavourite={
              !shared && tree.onToggleFavourite ? () => tree.onToggleFavourite?.(doc.id) : undefined
            }
            recentExcluded={tree.recentExcludedIds?.includes(doc.id) === true}
            onToggleRecentExclusion={
              tree.onToggleRecentExclusion
                ? () => tree.onToggleRecentExclusion?.(doc.id)
                : undefined
            }
          />
        ) : null}
      </>
    ),
  };
}
