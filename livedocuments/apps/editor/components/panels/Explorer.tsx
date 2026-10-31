'use client';

import { memo, useCallback, useEffect, useMemo } from 'react';
import {
  ExplorerPanel,
  explorerPath,
  useOpenItem,
  type RenderAppLogo,
} from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import Link from 'next/link';
import { BrandMark, ProductNavLinks } from '@livedocuments/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useMinimalChrome } from '@liveworkspace/workbench/components/providers/minimal-chrome';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useThisBrowserHost } from '@/hooks/persistence/useThisBrowserHost';
import { useOfflineItemMenu } from '@/hooks/persistence/useOfflineItemMenu';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';
import { useAppNavigation } from '@liveworkspace/workbench/hooks/navigation/useAppNavigation';
import { API_BASE, getSessionSharePassword } from '@/lib/api-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { explorerLibrary } from '@/lib/explorer-library';
import { explorerTeamsHost } from '@liveworkspace/workbench/lib/explorer-teams-host';
import { itemHref, newDocumentHref, shareUrl, useTokenTeams } from '@/lib/explorer-host';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerCommunity } from '@/lib/explorer-community-host';
import { useCommunityEnabled } from '@liveworkspace/community-ui';
import { explorerInboxActions, explorerInboxHost } from '@/lib/explorer-inbox-host';
import { trackOrganise } from '@/lib/explorer-organise';
import { renderDocumentThumbnail } from '@/lib/explorer-thumbnail';
import { trashOpenDocument } from '@/lib/document-delete-undo';
import { cloudSyncHost } from '@/components/dialogs/settings/settings-panel-host';
import type { ExplorerProps } from './Explorer.types';

// The filter's logos: this app's own, and liveworkspace's for All.
const renderAppLogo: RenderAppLogo = (app) =>
  app === 'all' ? <BrandMark accentColor={PLATFORM_SITE.accent} /> : <BrandMark />;

// The popover hangs from its button and is never dragged.
const NO_MOVE = () => {};

// The editor's floating Explorer panel: the shared Explorer's panel (@liveworkspace/explorer, drawn as this panel
// always was, with the same lists, menus and dialogs as the /explorer page, from the index) inside the editor's
// movable panel, opened only as the canvas menu button's popover. The open document shows on top, read
// once from the index when the panel opens; every list is one request a page, loaded only once its section is chosen.
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
  // The person: an account, or this browser's guest, as the Explorer page has them, so the Timeline, History and
  // the Inbox name their own doings as theirs.
  const guestId = useSignedGuestId(authLoaded, accountUserId);
  const viewerId = accountUserId ?? guestId;
  // Take Offline and Sync Document on a document's menu.
  const itemMenu = useOfflineItemMenu(viewerId);
  const thisBrowser = useThisBrowserHost(viewerId, !!accountUserId);
  // The Community tab for a signed-in account's own documents (lib/explorer-community-host.ts), asked whether the
  // Community is on only for an account.
  const communityOn = useCommunityEnabled(API_BASE, !!accountUserId);
  const shareHost = useMemo(
    () => ({
      ...explorerShareHost(viewerId),
      community: explorerCommunity(
        accountUserId ? { id: accountUserId, name: accountDisplayName } : null,
        communityOn,
      ),
    }),
    [viewerId, accountUserId, accountDisplayName, communityOn],
  );
  const inboxBase = useMemo(() => explorerInboxHost(viewerId), [viewerId]);
  // The pane's verbs: this app's threads, and an action on the open document's active tab.
  const inboxActions = useMemo(
    () =>
      explorerInboxActions(
        viewerId,
        currentDocumentId && inboxOpenAction
          ? { itemId: currentDocumentId, ...inboxOpenAction }
          : null,
      ),
    [viewerId, currentDocumentId, inboxOpenAction],
  );
  const inboxHost = useMemo(
    () => ({ ...inboxBase, actions: inboxActions }),
    [inboxBase, inboxActions],
  );
  // The person's teams, made and run in place (New Team, a team's Members) for a signed-in person.
  const teams = useTokenTeams(isSignedIn);
  // Google Drive's marks on the person's items (liveworkspace/docs/specs/005-drive/drive.md "The Explorer shows each item's sync"),
  // over the same Drive host as Settings' Cloud Sync: an account's only, made once per sign-in so the marks read keeps
  // one client. The panel mounts only while open, so nothing is asked before it opens.
  const drive = useMemo(() => (isSignedIn ? cloudSyncHost() : null), [isSignedIn]);

  // The open document as the index has it (its title, place and star), for the card on top.
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
      layoutChrome
      // Never faded by Panel opacity: its menus open outside it (docs/specs/007-editor/user-preferences.md).
      opaque
      // Only ever the menu button's popover: never placed in a corner or dragged.
      position={null}
      defaultCorner="top-left"
      // Roomy on a desktop or tablet: up to 60rem wide (kept 1rem inside the window) and 56rem tall (kept on the
      // canvas below its button, 24px short of its edge), over a dimmed scrim on every screen size.
      popoverWidth="w-[60rem]"
      popoverHeight="56rem"
      popoverScrim
      // On a phone it opens as a sheet: edge to edge, down to the tab bar.
      popoverSheet={sheet}
      onMoveTo={NO_MOVE}
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
        app="livedocuments"
        onOrganise={trackOrganise}
        client={indexClient}
        itemHref={itemHref}
        current={currentDocumentId ? current : null}
        currentId={currentDocumentId ?? null}
        // The open document stops saving before it goes, then the editor leaves for the Explorer and its Undo.
        onTrashCurrent={trashCurrent}
        onRenameCurrent={onRenameCurrent}
        onCreate={(placement) =>
          onNewDocument && !placement.folderId && !placement.teamId
            ? onNewDocument()
            : go(newDocumentHref(placement))
        }
        onOpenExplorer={(view) => go(explorerPath(view))}
        onOpenItem={(href) => go(href)}
        renderThumbnail={renderDocumentThumbnail}
        drive={drive}
        Link={Link}
        teams={teams}
        viewerId={viewerId}
        shareUrl={shareUrl}
        share={shareHost}
        inbox={inboxHost}
        // The documents kept only in this browser, which no index list holds: This Browser on the rail, in place.
        thisBrowser={thisBrowser}
        itemMenu={itemMenu}
        // The Library section: the Image Gallery over this app's API.
        {...explorerLibrary}
        teamsHost={isSignedIn ? explorerTeamsHost : null}
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
