'use client';

// The Explorer inside a workbench's workspace frame (WorkspaceFrame.tsx): the shared Explorer
// (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md) for the person. The Explorer page itself is
// liveworkspace's, served at this address's /explorer (@liveworkspace/workbench/lib/explorer-href.ts); a frame keeps its own. Everything it
// lists comes from the index through /api/index; livediagram supplies the addresses and Help articles
// (lib/explorer-host.ts), New (the /new flow), the Library (Image Gallery, Shape Libraries and Import from,
// lib/explorer-library-host.tsx), the hero's setting (the synced
// `homeBanner` preference, docs/specs/013-workspace/explorer-home.md "Hiding the banner"), and the person: an
// account's teams from its token, or a guest's identity from liveworkspace, which the first visit fetches before the
// Explorer asks for anything.

import Link from 'next/link';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Explorer,
  type ExplorerView,
  type FolderShown,
  type LensTelemetryType,
  type TimelineTelemetry,
  type HomeTelemetry,
} from '@liveworkspace/explorer';
import { DEFAULT_FOLDER_OPTIONS } from '@livediagram/api-schema';
import { CANVAS_TEMPLATE_FAMILIES } from '@/lib/canvas-template-families';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { useGuestId } from '@/hooks/persistence/useGuestId';
import { useAppNavigation } from '@liveworkspace/workbench/hooks/navigation/useAppNavigation';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerInboxHost } from '@/lib/explorer-inbox-host';
import { explorerImports, explorerLibraryHosts } from '@/lib/explorer-library-host';
import { renderDocumentThumbnail } from '@/lib/explorer-thumbnail';
import { arrivedTrashed } from '@/lib/document-delete-undo';
import { trackOrganise } from '@/lib/explorer-organise';
import { track } from '@/lib/telemetry';
import { commitUserPreferences, type UserPreferences } from '@/lib/user-preferences';
import {
  explorerHelpHref,
  itemHref,
  newDocumentHref,
  shareUrl,
  useTokenTeams,
} from '@/lib/explorer-host';

// The Timeline's reports (docs/specs/017-telemetry/telemetry.md "Timeline"), each a literal pair so the telemetry
// manifest's coverage test sees it. The type is a fixed token from the Explorer: a mode, a filter, More or Retry,
// Card or Stack.
const trackTimeline: TimelineTelemetry = (action, type) => {
  switch (action) {
    case 'Changed':
      return track('Timeline', 'Changed', type);
    case 'Selected':
      return track('Timeline', 'Selected', type);
    case 'Loaded':
      return track('Timeline', 'Loaded', type);
    case 'Opened':
      return track('Timeline', 'Opened', type);
    case 'Removed':
      return track('Timeline', 'Removed', type);
  }
};

// Home's What Happened, and a failed read of Home retried: literal calls, so the telemetry manifest scan sees each
// pair.
const trackHome: HomeTelemetry = (action, type) => {
  switch (action) {
    case 'Selected':
      return track('Home', 'Selected', type);
    case 'Opened':
      return track('Home', 'Opened', type);
    case 'Loaded':
      return track('Home', 'Loaded', type);
  }
};

// The filter lens (docs/specs/013-workspace/explorer-filters.md "Telemetry"): a facet that gained a value, never the
// value. Literal calls, so the telemetry manifest scan sees the pair.
const trackLens = (type: LensTelemetryType) => track('Explorer', 'Selected', type);

/** What the host's chrome around the Explorer needs: the person's synced preferences and whose they are. */
export type ExplorerChrome = { prefs: UserPreferences; ownerId: string | null; signedIn: boolean };

// The Explorer for the person, in a workbench's workspace frame (WorkspaceFrame.tsx), which names the view itself and catches the Explorer's
// moves through the app's navigation interceptor. A frame draws the Explorer's own slim search bar; a host may hand
// it a header (`header`) and draw its own chrome after it (`children`).
export function ExplorerHost({
  view,
  header,
  children,
  onFolderShown,
}: {
  view: ExplorerView;
  header?: (search: ReactNode, chrome: ExplorerChrome) => ReactNode;
  children?: (chrome: ExplorerChrome) => ReactNode;
  // The folder on screen, once its list is in (a workspace frame's place says it).
  onFolderShown?: (shown: FolderShown) => void;
}) {
  const router = useAppNavigation();
  const { isSignedIn, authLoaded, accountUserId } = useAccountBootstrap();
  const guestId = useGuestId(authLoaded, accountUserId);
  const teams = useTokenTeams(isSignedIn);
  const viewerId = accountUserId ?? guestId;
  const shareHost = useMemo(() => explorerShareHost(viewerId ?? null), [viewerId]);
  const inboxHost = useMemo(() => explorerInboxHost(viewerId ?? null), [viewerId]);
  const library = useMemo(() => explorerLibraryHosts(), []);
  // The synced preferences (docs/specs/007-editor/user-preferences.md): the device cache at once, the server's
  // copy merged in once the person is known.
  const { userPreferences: prefs } = useEditorPreferences({
    ownerId: viewerId ?? 'self',
    passwordGated: false,
  });
  const chrome: ExplorerChrome = { prefs, ownerId: viewerId ?? null, signedIn: !!accountUserId };
  // The open canvas deleted from the editor lands here with its Undo (lib/document-delete-undo.ts), taken once.
  const [trashedOnArrival] = useState(arrivedTrashed);
  // The hero's close (docs/specs/013-workspace/explorer-home.md "Hiding the banner"): reported, then written, so
  // every device the person signs in on opens Home without it. Settings > Documents turns it back on.
  const hideHero = useCallback(() => {
    track('UI', 'Toggled', 'HomeBannerOff');
    commitUserPreferences(prefs, { ...prefs, homeBanner: false }, viewerId ?? null);
  }, [prefs, viewerId]);

  // The Explorer asks the index as the person, so it waits until there is one.
  if (!viewerId)
    return (
      <>
        {header?.(null, chrome)}
        <p role="status" className="m-auto text-sm text-slate-500 dark:text-slate-400">
          Opening your Explorer…
        </p>
        {children?.(chrome)}
      </>
    );
  return (
    <>
      <Explorer
        app="livediagram"
        client={indexClient}
        view={view}
        // The filter field's writes replace the entry, so typing leaves one history entry, not one per pause.
        onNavigate={(_view, href, options) =>
          options?.replace ? router.replace(href) : router.push(href)
        }
        itemHref={itemHref}
        onCreate={(placement) => router.push(newDocumentHref(placement))}
        onOpenItem={(href) =>
          href.startsWith('/') ? router.push(href) : window.location.assign(href)
        }
        Link={Link}
        teams={teams}
        viewerId={viewerId}
        shareUrl={shareUrl}
        share={shareHost}
        inbox={inboxHost}
        helpHref={explorerHelpHref}
        renderThumbnail={renderDocumentThumbnail}
        trashedOnArrival={trashedOnArrival}
        heroHidden={prefs.homeBanner === false}
        onHideHero={hideHero}
        onTimeline={trackTimeline}
        onHome={trackHome}
        onOrganise={trackOrganise}
        lensTemplates={CANVAS_TEMPLATE_FAMILIES}
        defaultFolderOptions={DEFAULT_FOLDER_OPTIONS}
        onFolderShown={onFolderShown}
        gallery={library.gallery}
        shapeLibraries={library.shapeLibraries}
        imports={explorerImports}
        onLensSelected={trackLens}
        header={header ? ({ search }) => header(search, chrome) : undefined}
      />
      {children?.(chrome)}
    </>
  );
}
