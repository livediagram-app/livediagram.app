'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { trackOrganise } from '@/lib/explorer-organise';
import { ExplorerPanel, explorerPath } from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import Link from 'next/link';
import { ProductNavLinks } from '@livediagram/ui';
import { ThisBrowserRow } from '@/components/panels/ThisBrowserRow';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useOfflineItemMenu } from '@/hooks/persistence/useOfflineItemMenu';
import { useGuestId } from '@/hooks/persistence/useGuestId';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { getSessionSharePassword } from '@/lib/api-client';
import { indexClient } from '@/lib/index-client';
import { itemHref, newDocumentHref, shareUrl, useTokenTeams } from '@/lib/explorer-host';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerInboxHost } from '@/lib/explorer-inbox-host';
import { explorerImports, explorerLibraryHosts } from '@/lib/explorer-library-host';
import { renderDocumentThumbnail } from '@/lib/explorer-thumbnail';
import { driveItemMarks } from '@/lib/explorer-item-marks';
import { trashOpenDocument } from '@/lib/document-delete-undo';
import type { ExplorerProps } from './Explorer.types';

// The editor's floating Explorer panel: the shared Explorer's panel (@liveworkspace/explorer, with the same lists,
// menus and dialogs as the Explorer at /explorer, from the index) inside the editor's movable panel, which docks in a
// corner or opens as the menu button's popover. The open canvas shows on top, read once from the index when the panel
// opens; every list is one request a page, loaded only once its section is chosen. The person's Image Gallery and
// Shape Libraries come through this site's API, and Import from opens this site's /import page.
//
// Wrapped in React.memo so it skips re-rendering on the editor's per-drag-frame churn: its props are a position, ids
// and stable handlers.
function ExplorerImpl({
  position,
  currentDocumentId,
  currentShareCode = null,
  onRenameCurrent,
  onMoveTo,
  onReset,
  onNewDocument,
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
  // Take Offline and Sync Canvas on a canvas's menu, as the person (an account, or this browser's guest).
  const guestId = useGuestId(authLoaded, accountUserId);
  const itemMenu = useOfflineItemMenu(accountUserId ?? guestId);
  const shareHost = useMemo(() => explorerShareHost(accountUserId ?? null), [accountUserId]);
  const inboxHost = useMemo(() => explorerInboxHost(accountUserId ?? null), [accountUserId]);
  const library = useMemo(() => explorerLibraryHosts(), []);
  const teams = useTokenTeams(isSignedIn);

  // The open canvas as the index has it (its title, place and star), for the card on top.
  const [current, setCurrent] = useState<Item | null>(null);
  useEffect(() => {
    if (!currentDocumentId) return;
    let live = true;
    const share = currentShareCode
      ? { code: currentShareCode, password: getSessionSharePassword() }
      : null;
    indexClient.getItem(currentDocumentId, share).then(
      ({ item }) => live && setCurrent(item),
      () => live && setCurrent(null),
    );
    return () => {
      live = false;
    };
  }, [currentDocumentId, currentShareCode]);

  // Open, the panel reaches under the palette strip: the trays hanging from it step aside (PaletteTray).
  const shown = asPopover === true && popoverOpen === true;
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
      position={position}
      // On mobile the panel becomes a full-width top banner; on desktop it stays in the top-left corner.
      defaultCorner={isMobile ? 'top-banner' : 'top-left'}
      width={isMobile ? 'w-auto' : 'w-80'}
      popoverWidth="w-[38rem]"
      // On a phone it opens as a sheet: edge to edge, down to the tab bar.
      popoverSheet={sheet}
      onReset={onReset}
      onMoveTo={onMoveTo}
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
      {...dock}
      popoverOpen={popoverOpen}
      onPopoverClose={onPopoverClose}
      popoverAnchor={popoverAnchor}
      asPopover={asPopover}
      dismissOnOutside={dismissOnOutside}
      collapsible
    >
      <ExplorerPanel
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
        // The whole Explorer, on this address (lib/explorer-href.ts), on the same view. A full load: the editor
        // serves no /explorer page; the router answers it with liveworkspace's.
        onOpenExplorer={(view) => window.location.assign(explorerPath(view))}
        onOpenItem={(href) => go(href)}
        renderThumbnail={renderDocumentThumbnail}
        renderItemMark={driveItemMarks(accountUserId ?? null)}
        Link={Link}
        teams={teams}
        viewerId={accountUserId ?? null}
        shareUrl={shareUrl}
        share={shareHost}
        inbox={inboxHost}
        onOrganise={trackOrganise}
        itemMenu={itemMenu}
        gallery={library.gallery}
        shapeLibraries={library.shapeLibraries}
        imports={explorerImports}
        // Side by side in a desktop popover; chips over the pane on a phone and in the corner panel that stands
        // beside the status screens, which must stay narrow or it covers their card.
        layout={sheet ? 'sheet' : isMobile || !asPopover ? 'stacked' : 'side'}
        open={shown}
        divider={minimalChrome ? 'lines' : 'titles'}
        // The sign-in note under the card (an onboarding notice: Minimal chrome drops it).
        notice={minimalChrome ? null : <SignInPrompt bar />}
        footer={
          <>
            {/* The canvases kept only in this browser, which no Explorer list holds. */}
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
