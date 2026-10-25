'use client';

import { explorerHref } from '@/lib/explorer-href';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ExplorerPanel, explorerPath, type RenderAppLogo } from '@liveworkspace/explorer';
import { trackOrganise } from '@/lib/explorer-organise';
import type { Item } from '@liveworkspace/index-client';
import Link from 'next/link';
import { BrandMark, ProductNavLinks } from '@livedesign/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useMinimalChrome } from '@liveworkspace/workbench/components/providers/minimal-chrome';
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
import { explorerTeamsHost } from '@/lib/explorer-teams-host';
import { itemHref, newDesignHref, shareUrl, useTokenTeams } from '@/lib/explorer-host';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerInboxHost } from '@/lib/explorer-inbox-host';
import { renderDesignThumbnail } from '@/lib/explorer-thumbnail';
import { trashOpenDesign } from '@/lib/design-delete-undo';
import type { ExplorerProps } from './Explorer.types';

// The filter's logos: this app's own, and liveworkspace's for All.
const renderAppLogo: RenderAppLogo = (app) =>
  app === 'all' ? <BrandMark accentColor={PLATFORM_SITE.accent} /> : <BrandMark />;

// The popover hangs from its button and is never dragged.
const NO_MOVE = () => {};

// The editor's floating Explorer panel: the shared Explorer's panel (@liveworkspace/explorer, drawn as this panel
// always was, with the same lists, menus and dialogs as the /explorer page, from the index) inside the editor's
// movable panel, opened only as the canvas menu button's popover. The open design shows on top, read
// once from the index when the panel opens; every list is one request a page, loaded only once its section is chosen.
function ExplorerImpl({
  currentDesignId,
  currentShareCode = null,
  onRenameCurrent,
  onNewDesign,
  menuActions,
  popoverOpen,
  onPopoverClose,
  popoverAnchor,
}: ExplorerProps) {
  const minimalChrome = useMinimalChrome();
  const isMobile = useIsMobileViewport();
  const sheet = isMobile;
  const router = useAppNavigation();
  const { isSignedIn, authLoaded, accountUserId } = useAccountBootstrap();
  // The person: an account, or this browser's guest, as the Explorer page has them, so the Timeline, History and
  // the Inbox name their own doings as theirs.
  const guestId = useSignedGuestId(authLoaded, accountUserId);
  const viewerId = accountUserId ?? guestId;
  // Take Offline and Sync Design on a design's menu.
  const itemMenu = useOfflineItemMenu(viewerId);
  const shareHost = useMemo(() => explorerShareHost(viewerId), [viewerId]);
  const inboxHost = useMemo(() => explorerInboxHost(viewerId), [viewerId]);
  // The person's teams, made and run in place (New Team, a team's Members) for a signed-in person.
  const teams = useTokenTeams(isSignedIn);

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
  const shown = popoverOpen === true;
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
      // Only ever the menu button's popover: never placed in a corner or dragged.
      position={null}
      defaultCorner="top-left"
      popoverWidth="w-[38rem]"
      // On a phone it opens as a sheet: edge to edge, down to the tab bar.
      popoverSheet={sheet}
      onMoveTo={NO_MOVE}
      headerActions={
        sheet ? undefined : (
          <ExplorerHeaderMenu
            onNewDesign={onNewDesign}
            actions={menuActions}
            helpArticle="explorerPanel"
          />
        )
      }
      popoverOpen={popoverOpen}
      onPopoverClose={onPopoverClose}
      popoverAnchor={popoverAnchor}
      asPopover
      dismissOnOutside
    >
      <ExplorerPanel
        renderAppLogo={renderAppLogo}
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
        // The whole Explorer page, on the same view (lib/explorer-href.ts says where it is).
        onOpenExplorer={(view) => {
          const [path = '', query = ''] = explorerPath(view).split('?');
          window.location.assign(explorerHref(path.replace(/^\/?explorer\/?/, ''), query));
        }}
        onOpenItem={(href) => go(href)}
        renderThumbnail={renderDesignThumbnail}
        Link={Link}
        teams={teams}
        viewerId={viewerId}
        shareUrl={shareUrl}
        share={shareHost}
        inbox={inboxHost}
        itemMenu={itemMenu}
        // The Library section: the Image Gallery over this app's API.
        {...explorerLibrary}
        teamsHost={isSignedIn ? explorerTeamsHost : null}
        onOrganise={trackOrganise}
        // Side by side in a desktop popover; a phone's sheet stacks the chips over the pane.
        layout={sheet ? 'sheet' : 'side'}
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
