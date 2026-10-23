'use client';

// The one design menu for any design the editor's Explorer pane shows (docs/specs/013-workspace/
// explorer-structure.md "The pane"): the Explorer page's own DesignActionsMenu, opened from the row's ⋯, a
// right-click or Shift+F10, with the verbs the host wired. Home's cards, What Happened, the Timeline and the places'
// rows all take it from here, so a design offers the same verbs wherever it appears.
import type { MouseEvent, ReactNode } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { DesignActionsMenu } from '@/app/explorer/design-row-shared';
import type { PaneDesign } from '@/app/explorer/views';
import { usePanelTree } from './PanelTreeContext';

export function usePaneDesignMenu(doc: PaneDesign | undefined): {
  onContextMenu?: (e: MouseEvent) => void;
  trailing: ReactNode;
} {
  const tree = usePanelTree();
  const menu = useRowMenu({ disabled: !doc });
  if (!doc) return { trailing: null };
  const name = doc.name || 'Untitled design';
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
          <DesignActionsMenu
            design={doc}
            anchor={menu.triggerRef.current}
            ownerId={tree.ownerId}
            onClose={menu.close}
            isOpen={doc.id === tree.currentDesignId}
            onOpen={() => tree.onOpenDesign(doc.id, shareCode)}
            onDismiss={
              shared && tree.onDismissShared ? () => tree.onDismissShared?.(doc.id) : undefined
            }
            onDuplicate={
              !shared && tree.onDuplicateDesign
                ? () => tree.onDuplicateDesign?.(doc.id)
                : undefined
            }
            onMove={
              shared
                ? undefined
                : team
                  ? tree.onMoveTeamDesignRequest
                    ? () => tree.onMoveTeamDesignRequest?.(doc.id, team.id)
                    : undefined
                  : tree.onMoveDesignRequest
                    ? () => tree.onMoveDesignRequest?.(doc.id)
                    : undefined
            }
            onDelete={
              !shared && tree.onDeleteDesign
                ? () => tree.onDeleteDesign?.(doc.id, menu.triggerRef.current)
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
