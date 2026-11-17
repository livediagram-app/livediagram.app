'use client';

import { memo, useCallback, useEffect, useMemo } from 'react';
import { trackOrganise } from '@/lib/explorer-organise';
import { track } from '@/lib/telemetry';
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
import { BrandMark, ProductNavLinks, useCommunityEnabled } from '@livehuddle/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { leaveArchivedItem } from '@liveworkspace/workbench/lib/archived';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useThisBrowserHost } from '@/hooks/persistence/useThisBrowserHost';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
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
// menus and dialogs as the Explorer at /explorer, from the index) inside the editor's movable panel, opened only as the
// canvas menu button's popover. The open canvas shows on top, from the index and the editor's own title; every list is
// one request a page, loaded only once its section is chosen. The person's Image Gallery comes through this site's API,
// and Import from opens this site's /import page.
//
// Wrapped in React.memo so it skips re-rendering on the editor's per-drag-frame churn: its props are ids and stable
// handlers.
function ExplorerImpl({
  currentDocumentId,
  currentTitle = null,
  currentShareCode = null,
  onRenameCurrent,
  onNewDocument,
  menuActions,
  popoverOpen,
  onPopoverClose,
  popoverAnchor,
}: ExplorerProps) {
  const isMobile = useIsMobileViewport();
  const sheet = isMobile;
  const router = useAppNavigation();
  const { isSignedIn, authLoaded, accountUserId, accountDisplayName } = useAccountBootstrap();
  // Take Offline and Sync Space on a canvas's menu, as the person (an account, or this browser's guest).
  const guestId = useGuestId(authLoaded, accountUserId);
  const itemMenu = useOfflineItemMenu(accountUserId ?? guestId);
  const thisBrowser = useThisBrowserHost(
    accountUserId ?? guestId,
    !!accountUserId,
    currentDocumentId ?? null,
  );
  const communityOn = useCommunityEnabled(API_BASE);
  const shareHost = useMemo(
    () => ({
      ...explorerShareHost(accountUserId ?? null),
      community: explorerCommunity(
        accountUserId ? { id: accountUserId, name: accountDisplayName } : null,
        communityOn,
        guestId ?? null,
      ),
    }),
    [accountUserId, accountDisplayName, communityOn, guestId],
  );
  // No Inbox host: livehuddle has no Inbox (@liveworkspace/explorer appHasInbox, docs/specs/002-project-scope/
  // not-in-livehuddle.md "Comments, actions, links and notes").
  const library = useMemo(() => explorerLibraryHosts(), []);
  // The person's teams, made and run in place (New Team, a team's Members) for a signed-in person.
  const teams = useTokenTeams(isSignedIn);
  // Google Drive's marks on the person's items (liveworkspace/docs/specs/005-drive/drive.md "The Explorer shows each item's sync"),
  // over the same Drive host as Settings' Cloud Sync: an account's only, made once per sign-in so the marks read keeps
  // one client. The panel mounts only while open, so nothing is asked before it opens.
  const drive = useMemo(() => (isSignedIn ? cloudSyncHost() : null), [isSignedIn]);

  // Open, the panel reaches under the palette strip: the trays just under it step aside (PaletteTray).
  const shown = popoverOpen === true;
  // Kept only in this browser? Then the index is not asked and the card is This Browser's, with its Browser Storage
  // pill, before the list has heard of it too (one-explorer.md "The Current card"). An opening asks the index again
  // while it had nothing for the canvas (a new one registered since).
  const offline = useIsOfflineDocument(currentDocumentId ?? null);
  const current = useOpenItem(
    indexClient,
    currentDocumentId,
    currentShareCode,
    getSessionSharePassword,
    { offline, open: shown },
  );
  useEffect(() => {
    if (!shown) return;
    document.body.setAttribute('data-explorer-open', '');
    return () => document.body.removeAttribute('data-explorer-open');
  }, [shown]);

  const trashCurrent = useCallback((item: Item) => trashOpenDocument(item.id, item.title), []);
  // Archived is closed: the item open here, once archived from the panel, leaves for the Explorer, which says so.
  const archivedCurrent = useCallback(
    (item: { id: string; title: string | null }) => leaveArchivedItem('livehuddle', item),
    [],
  );

  const go = (href: string) =>
    href.startsWith('/') ? router.push(href) : window.location.assign(href);

  return (
    <>
      <MovablePanel
        helpArticle="explorerPanel"
        title="Explorer"
        dataTourId="explorer"
        // Never faded by Panel opacity: its menus open outside it (docs/specs/007-editor/user-preferences.md).
        opaque
        // Only ever the menu button's popover: never placed in a corner or dragged.
        position={null}
        defaultCorner="top-left"
        // Roomy on a desktop or tablet: up to 54rem wide (kept 1rem inside the window) and 45rem tall (kept on the
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
              itemId={currentDocumentId}
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
          // History and Webhooks live in the footer's Tools, for the open item (footer-tools-menu.md).
          history={false}
          webhooks={false}
          renderAppLogo={renderAppLogo}
          app="livehuddle"
          client={indexClient}
          itemHref={itemHref}
          current={currentDocumentId ? current : null}
          currentId={currentDocumentId ?? null}
          currentTitle={currentTitle}
          currentOffline={offline}
          // The open canvas stops saving before it goes, then the editor leaves for the Explorer and its Undo.
          onTrashCurrent={trashCurrent}
          onArchivedCurrent={archivedCurrent}
          // Renamed from the Explorer's current item, the editor's one rename since the header bar went (experiment).
          onRenameCurrent={
            onRenameCurrent
              ? (name: string) => {
                  track('Document', 'Renamed');
                  onRenameCurrent(name);
                }
              : undefined
          }
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
          // The canvases kept only in this browser, which no index list holds: This Browser on the rail, in place.
          thisBrowser={thisBrowser}
          onOrganise={trackOrganise}
          itemMenu={itemMenu}
          gallery={library.gallery}
          imports={explorerImports}
          // Side by side in a desktop popover; a phone's sheet stacks the chips over the pane.
          layout={sheet ? 'sheet' : 'side'}
          open={shown}
          // The sign-in note under the card.
          notice={<SignInPrompt bar />}
          // The product's surfaces, which the editor header no longer carries as a menu.
          footer={
            <ProductNavLinks
              current="editor"
              className={`overflow-x-auto border-t border-slate-200 px-1.5 py-1 [scrollbar-width:none] dark:border-slate-700/70 ${sheet ? 'justify-evenly' : ''}`}
            />
          }
        />
      </MovablePanel>
    </>
  );
}

export const Explorer = memo(ExplorerImpl);
