'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ExplorerPanel, explorerPath, type RenderAppLogo } from '@liveworkspace/explorer';
import { trackOrganise } from '@/lib/explorer-organise';
import type { Item } from '@liveworkspace/index-client';
import Link from 'next/link';
import { BrandMark, ProductNavLinks } from '@liveplanner/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useMinimalChrome } from '@liveworkspace/workbench/components/providers/minimal-chrome';
import { SignInPrompt } from '@/components/chrome/SignInPrompt';
import { ExplorerHeaderMenu } from '@/components/panels/ExplorerHeaderMenu';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';
import { useThisBrowserHost } from '@/hooks/persistence/useThisBrowserHost';
import { useAppNavigation } from '@liveworkspace/workbench/hooks/navigation/useAppNavigation';
import { getSessionSharePassword } from '@/lib/api-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { explorerTeamsHost } from '@liveworkspace/workbench/lib/explorer-teams-host';
import { itemHref, newPlanHref, shareUrl, useTokenTeams } from '@/lib/explorer-host';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerInboxHost } from '@/lib/explorer-inbox-host';
import { renderPlanThumbnail } from '@/lib/explorer-thumbnail';
import { trashOpenPlan } from '@/lib/project-delete-undo';
import type { ExplorerProps } from './Explorer.types';

// The filter's logos: this app's own, and liveworkspace's for All.
const renderAppLogo: RenderAppLogo = (app) =>
  app === 'all' ? <BrandMark accentColor={PLATFORM_SITE.accent} /> : <BrandMark />;

// The popover hangs from its button and is never dragged.
const NO_MOVE = () => {};

// The editor's floating Explorer panel: the shared Explorer's panel (@liveworkspace/explorer, drawn as this panel
// always was, with the same lists, menus and dialogs as the /explorer page, from the index) inside the editor's
// movable panel, opened only as the canvas menu button's popover. The open plan shows on top, read
// once from the index when the panel opens; every list is one request a page, loaded only once its section is chosen.
function ExplorerImpl({
  currentProjectId,
  currentShareCode = null,
  onRenameCurrent,
  onNewProject,
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
  // The plans kept only in this browser, as the person (an account, or this browser's guest).
  const guestId = useSignedGuestId(authLoaded, accountUserId);
  const thisBrowser = useThisBrowserHost(accountUserId ?? guestId, !!accountUserId);
  const shareHost = useMemo(() => explorerShareHost(accountUserId ?? null), [accountUserId]);
  const inboxHost = useMemo(() => explorerInboxHost(accountUserId ?? null), [accountUserId]);
  // The person's teams, made and run in place (New Team, a team's Members) for a signed-in person.
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
  const shown = popoverOpen === true;
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
            onNewProject={onNewProject}
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
        // The whole Explorer, on this address (lib/explorer-href.ts), on the same view.
        onOpenExplorer={(view) => window.location.assign(explorerPath(view))}
        onOpenItem={(href) => go(href)}
        renderThumbnail={renderPlanThumbnail}
        Link={Link}
        teams={teams}
        teamsHost={isSignedIn ? explorerTeamsHost : null}
        viewerId={accountUserId ?? null}
        shareUrl={shareUrl}
        share={shareHost}
        inbox={inboxHost}
        // The plans kept only in this browser, which no index list holds: This Browser on the rail, in place.
        thisBrowser={thisBrowser}
        onOrganise={trackOrganise}
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
