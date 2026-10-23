'use client';

import { explorerHref } from '@/lib/explorer-redirect';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ExplorerPanel, explorerPath } from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import Link from 'next/link';
import { ProductNavLinks } from '@livedesign/ui';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import { ThisBrowserRow } from '@/components/panels/ThisBrowserRow';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useOfflineItemMenu } from '@/hooks/persistence/useOfflineItemMenu';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { getSessionSharePassword } from '@/lib/api-client';
import { indexClient } from '@/lib/index-client';
import { explorerLibrary } from '@/lib/explorer-library';
import { useExplorerNewTeam } from '@/lib/explorer-new-team';
import { itemHref, newDesignHref, shareUrl, useTokenTeams } from '@/lib/explorer-host';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerInboxHost } from '@/lib/explorer-inbox-host';
import { renderDesignThumbnail } from '@/lib/explorer-thumbnail';
import { trashOpenDesign } from '@/lib/design-delete-undo';
import type { ExplorerProps } from './Explorer.types';

// The editor's floating Explorer panel: the shared Explorer's panel (@liveworkspace/explorer, drawn as this panel
// always was, with the same lists, menus and dialogs as the /explorer page, from the index) inside the editor's
// movable panel, which docks in a corner or opens as the menu button's popover. The open design shows on top, read
// once from the index when the panel opens; every list is one request a page, loaded only once its section is chosen.
function ExplorerImpl({
  position,
  currentDesignId,
  currentShareCode = null,
  onRenameCurrent,
  onMoveTo,
  onReset,
  onNewDesign,
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
  const { isSignedIn, authLoaded, accountUserId } = useAccountBootstrap();
  // Take Offline and Sync Design on a design's menu, as the person (an account, or this browser's guest).
  const guestId = useSignedGuestId(authLoaded, accountUserId);
  const itemMenu = useOfflineItemMenu(accountUserId ?? guestId);
  const shareHost = useMemo(() => explorerShareHost(accountUserId ?? null), [accountUserId]);
  const inboxHost = useMemo(() => explorerInboxHost(accountUserId ?? null), [accountUserId]);
  // The person's teams, with New Team in the Move dialog making one on the spot.
  const tokenTeams = useTokenTeams(isSignedIn);
  const { teams, onCreateTeam } = useExplorerNewTeam(!!isSignedIn, tokenTeams);

  // The open design as the index has it (its title, place and star), for the card on top.
  const [current, setCurrent] = useState<Item | null>(null);
  useEffect(() => {
    if (!currentDesignId) return;
    let live = true;
    const share = currentShareCode
      ? { code: currentShareCode, password: getSessionSharePassword() }
      : null;
    indexClient.getItem(currentDesignId, share).then(
      ({ item }) => live && setCurrent(item),
      () => live && setCurrent(null),
    );
    return () => {
      live = false;
    };
  }, [currentDesignId, currentShareCode]);

  // Open, the panel reaches under the palette strip: the trays hanging from it step aside (PaletteTray).
  const shown = asPopover === true && popoverOpen === true;
  useEffect(() => {
    if (!shown) return;
    document.body.setAttribute('data-explorer-open', '');
    return () => document.body.removeAttribute('data-explorer-open');
  }, [shown]);

  const trashCurrent = useCallback((item: Item) => trashOpenDesign(item.id, item.title), []);

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
            onNewDesign={onNewDesign}
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
        app="livedesign"
        client={indexClient}
        itemHref={itemHref}
        current={currentDesignId ? current : null}
        currentId={currentDesignId ?? null}
        // The open design stops saving before it goes, then the editor leaves for the Explorer and its Undo.
        onTrashCurrent={trashCurrent}
        onRenameCurrent={onRenameCurrent}
        onCreate={(placement) =>
          onNewDesign && !placement.folderId && !placement.teamId
            ? onNewDesign()
            : go(newDesignHref(placement))
        }
        // The whole Explorer page, on the same view (lib/explorer-redirect.ts says where it is).
        onOpenExplorer={(view) => {
          const [path = '', query = ''] = explorerPath(view).split('?');
          window.location.assign(explorerHref(path.replace(/^\/?explorer\/?/, ''), query));
        }}
        onOpenItem={(href) => go(href)}
        renderThumbnail={renderDesignThumbnail}
        Link={Link}
        teams={teams}
        viewerId={accountUserId ?? null}
        shareUrl={shareUrl}
        share={shareHost}
        inbox={inboxHost}
        itemMenu={itemMenu}
        // The Library section: the Image Gallery over this app's API.
        {...explorerLibrary}
        onCreateTeam={onCreateTeam}
        // Side by side in a desktop popover; chips over the pane on a phone and in the corner panel that stands
        // beside the new-design wizard and the status screens, which must stay narrow or it covers their card.
        layout={sheet ? 'sheet' : isMobile || !asPopover ? 'stacked' : 'side'}
        open={shown}
        divider={minimalChrome ? 'lines' : 'titles'}
        // The sign-in note under the card (an onboarding notice: Minimal chrome drops it).
        notice={minimalChrome ? null : <SignInPrompt bar />}
        footer={
          <>
            {/* The designs kept only in this browser, which no Explorer list holds. */}
            <ThisBrowserRow />
            {/* The product's surfaces, which the editor header no longer carries as a menu. */}
            <ProductNavLinks
              current="editor"
              className={`overflow-x-auto border-t border-slate-200 px-1.5 py-1 [scrollbar-width:none] dark:border-slate-700/70 ${sheet ? 'justify-between' : ''}`}
            />
          </>
        }
      />
    </MovablePanel>
  );
}

export const Explorer = memo(ExplorerImpl);
