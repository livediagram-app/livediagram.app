'use client';

import { memo, useCallback, useEffect, useMemo } from 'react';
import { trackOrganise } from '@/lib/explorer-organise';
import {
  EXPLORER_POPOVER_HEIGHT,
  EXPLORER_POPOVER_WIDTH,
  ExplorerPanel,
  explorerPath,
  useOpenItem,
  type RenderAppLogo,
} from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import Link from 'next/link';
import { BrandMark, ProductNavLinks, useCommunityEnabled } from '@livediagram/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useMinimalChrome } from '@liveworkspace/workbench/components/providers/minimal-chrome';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useThisBrowserHost } from '@/hooks/persistence/useThisBrowserHost';
import { useOfflineItemMenu } from '@/hooks/persistence/useOfflineItemMenu';
import { useGuestId } from '@/hooks/persistence/useGuestId';
import { useAppNavigation } from '@liveworkspace/workbench/hooks/navigation/useAppNavigation';
import { getSessionSharePassword } from '@/lib/api-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { explorerTeamsHost } from '@liveworkspace/workbench/lib/explorer-teams-host';
import { itemHref, newDocumentHref, shareUrl, useTokenTeams } from '@/lib/explorer-host';
import { API_BASE } from '@/lib/api-client';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerCommunity } from '@/lib/explorer-community-host';
import { explorerInboxActions, explorerInboxHost } from '@/lib/explorer-inbox-host';
import { explorerImports, explorerLibraryHosts } from '@/lib/explorer-library-host';
import { renderDocumentThumbnail } from '@/lib/explorer-thumbnail';
import { trashOpenDocument } from '@/lib/document-delete-undo';
import { cloudSyncHost } from '@/components/dialogs/settings/settings-panel-host';
import type { ExplorerProps } from './Explorer.types';

// The filter's logos: this app's own, and liveworkspace's for All.
const renderAppLogo: RenderAppLogo = (app) =>
  app === 'all' ? <BrandMark accentColor={PLATFORM_SITE.accent} /> : <BrandMark />;

// The popover hangs from its button and is never dragged.
const NO_MOVE = () => {};

// The editor's floating Explorer panel: the shared Explorer's panel (@liveworkspace/explorer, with the same lists,
// menus and dialogs as the Explorer at /explorer, from the index) inside the editor's movable panel, opened only
// as the canvas menu button's popover. The open canvas shows on top, read once from the index when the panel
// opens; every list is one request a page, loaded only once its section is chosen. The person's Image Gallery and
// Shape Libraries come through this site's API, and Import from opens this site's /import page.
//
// Wrapped in React.memo so it skips re-rendering on the editor's per-drag-frame churn: its props are ids and stable
// handlers.
function ExplorerImpl({
  currentDocumentId,
  inboxOpenAction = null,
  currentShareCode = null,
  onRenameCurrent,
  onNewDocument,
  menuActions,
  popoverOpen,
  onPopoverClose,
  popoverAnchor,
}: ExplorerProps) {
  const minimalChrome = useMinimalChrome();
  const isMobile = useIsMobileViewport();
  const sheet = isMobile;
  const router = useAppNavigation();
  const { isSignedIn, authLoaded, accountUserId, accountDisplayName } = useAccountBootstrap();
  // Take Offline and Sync Canvas on a canvas's menu, as the person (an account, or this browser's guest).
  const guestId = useGuestId(authLoaded, accountUserId);
  const itemMenu = useOfflineItemMenu(accountUserId ?? guestId);
  const thisBrowser = useThisBrowserHost(
    accountUserId ?? guestId,
    !!accountUserId,
    currentDocumentId ?? null,
  );
  const communityOn = useCommunityEnabled(API_BASE, !!accountUserId);
  const shareHost = useMemo(
    () => ({
      ...explorerShareHost(accountUserId ?? null),
      community: explorerCommunity(
        accountUserId ? { id: accountUserId, name: accountDisplayName } : null,
        communityOn,
      ),
    }),
    [accountUserId, accountDisplayName, communityOn],
  );
  // A guest's too: their This Browser items' rows are theirs (lib/explorer-inbox-host.tsx).
  const inboxOwner = accountUserId ?? guestId ?? null;
  const inboxBase = useMemo(() => explorerInboxHost(inboxOwner), [inboxOwner]);
  // The pane's verbs: this app's threads, and an action on the open canvas's active tab.
  const inboxActions = useMemo(
    () =>
      explorerInboxActions(
        inboxOwner,
        currentDocumentId && inboxOpenAction
          ? { itemId: currentDocumentId, ...inboxOpenAction }
          : null,
      ),
    [inboxOwner, currentDocumentId, inboxOpenAction],
  );
  const inboxHost = useMemo(
    () => ({ ...inboxBase, actions: inboxActions }),
    [inboxBase, inboxActions],
  );
  const library = useMemo(() => explorerLibraryHosts(), []);
  // The person's teams, made and run in place (New Team, a team's Members) for a signed-in person.
  const teams = useTokenTeams(isSignedIn);
  // Google Drive's marks on the person's items (liveworkspace/docs/specs/005-drive/drive.md "The Explorer shows each item's sync"),
  // over the same Drive host as Settings' Cloud Sync: an account's only, made once per sign-in so the marks read keeps
  // one client. The panel mounts only while open, so nothing is asked before it opens.
  const drive = useMemo(() => (isSignedIn ? cloudSyncHost() : null), [isSignedIn]);

  // The open canvas as the index has it (its title, place and star), for the card on top.
  // Null when the index has none for it (kept only in this browser): the panel then draws its card from This
  // Browser's list (@liveworkspace/explorer ExplorerPanel).
  const current = useOpenItem(
    indexClient,
    currentDocumentId,
    currentShareCode,
    getSessionSharePassword,
  );

  // Open, the panel reaches under the palette strip: the trays hanging from it step aside (PaletteTray).
  const shown = popoverOpen === true;
  useEffect(() => {
    if (!shown) return;
    document.body.setAttribute('data-explorer-open', '');
    return () => document.body.removeAttribute('data-explorer-open');
  }, [shown]);

  const trashCurrent = useCallback((item: Item) => trashOpenDocument(item.id, item.title), []);

  const go = (href: string) =>
    href.startsWith('/') ? router.push(href) : window.location.assign(href);

  return (
    <MovablePanel
      helpArticle="explorerPanel"
      title="Explorer"
      dataTourId="explorer"
      // Never faded by Panel opacity: its menus open outside it (docs/specs/007-editor/user-preferences.md).
      opaque
      // Only ever the menu button's popover: never placed in a corner or dragged.
      position={null}
      defaultCorner="top-left"
      // Roomy on a desktop or tablet: up to 64rem wide (kept 1rem inside the window) and 56rem tall (kept on the
      // canvas below its button, 24px short of its edge), over a dimmed scrim on every screen size. Every editor's
      // panel takes the one size from the package.
      popoverWidth={EXPLORER_POPOVER_WIDTH}
      popoverHeight={EXPLORER_POPOVER_HEIGHT}
      popoverScrim
      // On a phone it opens as a sheet: edge to edge, down to the tab bar.
      popoverSheet={sheet}
      onMoveTo={NO_MOVE}
      // A phone's sheet drops the ⋯ menu: every entry is a tap away there already.
      headerActions={
        sheet ? undefined : (
          <ExplorerHeaderMenu
            onNewDocument={onNewDocument}
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
        app="livediagram"
        client={indexClient}
        itemHref={itemHref}
        current={currentDocumentId ? current : null}
        currentId={currentDocumentId ?? null}
        // The open canvas stops saving before it goes, then the editor leaves for the Explorer and its Undo.
        onTrashCurrent={trashCurrent}
        onRenameCurrent={onRenameCurrent}
        onCreate={(placement) =>
          onNewDocument && !placement.folderId && !placement.teamId
            ? onNewDocument()
            : go(newDocumentHref(placement))
        }
        // The whole Explorer, on this address (@liveworkspace/workbench/lib/explorer-href.ts), on the same view. A full load: the editor
        // serves no /explorer page; the router answers it with liveworkspace's.
        onOpenExplorer={(view) => window.location.assign(explorerPath(view))}
        onOpenItem={(href) => go(href)}
        renderThumbnail={renderDocumentThumbnail}
        drive={drive}
        Link={Link}
        teams={teams}
        teamsHost={isSignedIn ? explorerTeamsHost : null}
        viewerId={accountUserId ?? null}
        shareUrl={shareUrl}
        share={shareHost}
        inbox={inboxHost}
        // The canvases kept only in this browser, which no index list holds: This Browser on the rail, in place.
        thisBrowser={thisBrowser}
        onOrganise={trackOrganise}
        itemMenu={itemMenu}
        gallery={library.gallery}
        shapeLibraries={library.shapeLibraries}
        imports={explorerImports}
        // Side by side in a desktop popover; a phone's sheet stacks the chips over the pane.
        layout={sheet ? 'sheet' : 'side'}
        open={shown}
        divider={minimalChrome ? 'lines' : 'titles'}
        // The sign-in note under the card (an onboarding notice: Minimal chrome drops it).
        notice={minimalChrome ? null : <SignInPrompt bar />}
        // The product's surfaces, which the editor header no longer carries as a menu.
        footer={
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
