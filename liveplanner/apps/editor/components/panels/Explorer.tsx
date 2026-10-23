'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ExplorerPanel, explorerPath } from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import Link from 'next/link';
import { ProductNavLinks } from '@liveplanner/ui';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { getSessionSharePassword } from '@/lib/api-client';
import { indexClient } from '@/lib/index-client';
import { itemHref, newPlanHref, shareUrl, useTokenTeams } from '@/lib/explorer-host';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { renderPlanThumbnail } from '@/lib/explorer-thumbnail';
import { trashOpenPlan } from '@/lib/project-delete-undo';
import type { ExplorerProps } from './Explorer.types';

// The editor's floating Explorer panel: the shared Explorer's panel (@liveworkspace/explorer, drawn as this panel
// always was, with the same lists, menus and dialogs as the /explorer page, from the index) inside the editor's
// movable panel, which docks in a corner or opens as the menu button's popover. The open plan shows on top, read
// once from the index when the panel opens; every list is one request a page, loaded only once its section is chosen.
function ExplorerImpl({
  position,
  currentProjectId,
  currentShareCode = null,
  onRenameCurrent,
  onMoveTo,
  onReset,
  onNewProject,
  menuActions,
  dock,
  popoverOpen,
  onPopoverClose,
  popoverAnchor,
  asPopover,
  dismissOnOutside,
}: ExplorerProps) {
  const minimalChrome = useMinimalChrome();
  const isMobile = useIsMobileViewport();
  const sheet = isMobile && !!asPopover;
  const router = useAppNavigation();
  const { isSignedIn, accountUserId } = useAccountBootstrap();
  const shareHost = useMemo(() => explorerShareHost(accountUserId ?? null), [accountUserId]);
  const teams = useTokenTeams(isSignedIn);

  // The open plan as the index has it (its title, place and star), for the card on top.
  const [current, setCurrent] = useState<Item | null>(null);
  useEffect(() => {
    if (!currentProjectId) return;
    let live = true;
    const share = currentShareCode
      ? { code: currentShareCode, password: getSessionSharePassword() }
      : null;
    indexClient.getItem(currentProjectId, share).then(
      ({ item }) => live && setCurrent(item),
      () => live && setCurrent(null),
    );
    return () => {
      live = false;
    };
  }, [currentProjectId, currentShareCode]);

  // Open, the panel reaches under the palette strip: the trays hanging from it step aside (PaletteTray).
  const shown = asPopover === true && popoverOpen === true;
  useEffect(() => {
    if (!shown) return;
    document.body.setAttribute('data-explorer-open', '');
    return () => document.body.removeAttribute('data-explorer-open');
  }, [shown]);

  const trashCurrent = useCallback((item: Item) => trashOpenPlan(item.id, item.title), []);

  const go = (href: string) =>
    href.startsWith('/') ? router.push(href) : window.location.assign(href);

  return (
    <MovablePanel
      helpArticle="explorerPanel"
      title="Explorer"
      dataTourId="explorer"
      layoutChrome
      // Never faded by Panel opacity: its menus open outside it (docs/specs/007-editor/user-preferences.md).
      opaque
      position={position}
      defaultCorner={isMobile ? 'top-banner' : 'top-left'}
      width={isMobile ? 'w-auto' : 'w-80'}
      popoverWidth="w-[38rem]"
      // On a phone it opens as a sheet: edge to edge, down to the tab bar.
      popoverSheet={sheet}
      onReset={onReset}
      onMoveTo={onMoveTo}
      headerActions={
        sheet ? undefined : (
          <ExplorerHeaderMenu
            onNewProject={onNewProject}
            actions={menuActions}
            helpArticle="explorerPanel"
          />
        )
      }
      {...dock}
      popoverOpen={popoverOpen}
      onPopoverClose={onPopoverClose}
      popoverAnchor={popoverAnchor}
      asPopover={asPopover}
      dismissOnOutside={dismissOnOutside}
      collapsible
    >
      <ExplorerPanel
        app="liveplanner"
        client={indexClient}
        itemHref={itemHref}
        current={currentProjectId ? current : null}
        currentId={currentProjectId ?? null}
        // The open plan stops saving before it goes, then the editor leaves for the Explorer and its Undo.
        onTrashCurrent={trashCurrent}
        onRenameCurrent={onRenameCurrent}
        onCreate={(placement) =>
          onNewProject && !placement.folderId && !placement.teamId
            ? onNewProject()
            : go(newPlanHref(placement))
        }
        onOpenExplorer={(view) => go(explorerPath(view))}
        onOpenItem={(href) => go(href)}
        renderThumbnail={renderPlanThumbnail}
        Link={Link}
        teams={teams}
        viewerId={accountUserId ?? null}
        shareUrl={shareUrl}
        share={shareHost}
        // Side by side in a desktop popover; chips over the pane on a phone and in the corner panel that stands
        // beside the new-plan wizard and the status screens, which must stay narrow or it covers their card.
        layout={sheet ? 'sheet' : isMobile || !asPopover ? 'stacked' : 'side'}
        open={shown}
        divider={minimalChrome ? 'lines' : 'titles'}
        // The sign-in note under the card (an onboarding notice: Minimal chrome drops it).
        notice={minimalChrome ? null : <SignInPrompt bar />}
        footer={
          // The product's surfaces, which the editor header no longer carries as a menu.
          <ProductNavLinks
            current="editor"
            className={`overflow-x-auto border-t border-slate-200 px-1.5 py-1 [scrollbar-width:none] dark:border-slate-700/70 ${sheet ? 'justify-between' : ''}`}
          />
        }
      />
    </MovablePanel>
  );
}

export const Explorer = memo(ExplorerImpl);
