'use client';

// The Explorer inside a workbench's workspace frame (WorkspaceFrame.tsx): the shared Explorer
// (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md) for the person. The Explorer page itself is
// liveworkspace's, under livedesign's own /explorer (lib/explorer-href.ts); a frame keeps its own. Everything it
// lists comes from the index through /api/index; livedesign supplies the addresses and Help articles
// (lib/explorer-host.ts), New (the /new flow), the hero's art (the fanned previews) and its setting (the synced
// `homeBanner` preference, docs/specs/013-workspace/explorer-home.md "Hiding the banner"), and the person: an
// account's teams from its token, or a guest's identity from liveworkspace, which the first visit fetches before the
// Explorer asks for anything.

import Link from 'next/link';
import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Explorer,
  type ExplorerView,
  type LensTelemetryType,
  type TimelineTelemetry,
  type HomeTelemetry,
  type SidebarLink,
  type WelcomeManifest,
  type WelcomeTelemetryType,
} from '@liveworkspace/explorer';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { loadWelcome } from '@/lib/explorer-welcome';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { indexClient } from '@/lib/index-client';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerInboxHost } from '@/lib/explorer-inbox-host';
import { renderDesignThumbnail } from '@/lib/explorer-thumbnail';
import { arrivedTrashed } from '@/lib/design-delete-undo';
import { trackOrganise } from '@/lib/explorer-organise';
import { track } from '@/lib/telemetry';
import { commitUserPreferences, type UserPreferences } from '@/lib/user-preferences';
import {
  explorerHelpHref,
  itemHref,
  newDesignHref,
  shareUrl,
  useTokenTeams,
} from '@/lib/explorer-host';

// The hero's art fans three template previews (a logo and two wireframes); it loads with Home's hero rather than with
// every Explorer page.
const HeroTemplateFan = lazy(() =>
  import('@/components/panels/home/HeroTemplateFan').then((m) => ({ default: m.HeroTemplateFan })),
);
const HERO_ART = (
  <Suspense fallback={null}>
    <HeroTemplateFan />
  </Suspense>
);

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

// Home's first run: each a literal pair, so the telemetry manifest scan sees it.
const trackWelcome = (type: WelcomeTelemetryType) => track('Home', 'Selected', type);
const trackWelcomeOpened = () => track('Home', 'Opened', 'Welcome');

// The filter lens (docs/specs/013-workspace/explorer-filters.md "Telemetry"): a facet that gained a value, never the
// value. Literal calls, so the telemetry manifest scan sees the pair.
const trackLens = (type: LensTelemetryType) => track('Explorer', 'Selected', type);

/** What the host's chrome around the Explorer needs: the person's synced preferences and whose they are. */
export type ExplorerChrome = { prefs: UserPreferences; ownerId: string | null; signedIn: boolean };

/** The person the Explorer pages are for (an account, or a guest from liveworkspace, which the first visit fetches)
 *  and their synced preferences (docs/specs/007-editor/user-preferences.md): the device cache at once, the server's
 *  copy merged in once the person is known. */
function useExplorerChrome(): { chrome: ExplorerChrome; isSignedIn: boolean } {
  const { isSignedIn, authLoaded, accountUserId } = useAccountBootstrap();
  const guestId = useSignedGuestId(authLoaded, accountUserId);
  const viewerId = accountUserId ?? guestId ?? null;
  const { userPreferences: prefs } = useEditorPreferences({
    ownerId: viewerId ?? 'self',
    passwordGated: false,
  });
  return {
    chrome: { prefs, ownerId: viewerId, signedIn: !!accountUserId },
    isSignedIn: !!isSignedIn,
  };
}

// The Explorer for the person in a workbench's workspace frame (WorkspaceFrame.tsx), which names the view itself and
// catches the Explorer's moves through the app's navigation interceptor. A frame draws the Explorer's own slim search
// bar; a host may hand it a header (`header`), sidebar links (`sidebarLinks`) and draw after it (`children`).
export function ExplorerHost({
  view,
  header,
  children,
  sidebarLinks,
}: {
  view: ExplorerView;
  header?: (search: ReactNode, chrome: ExplorerChrome) => ReactNode;
  children?: (chrome: ExplorerChrome) => ReactNode;
  /** The host's own rows in the sidebar's More group (the /explorer pages' This Browser and Image Gallery). */
  sidebarLinks?: readonly SidebarLink[];
}) {
  const router = useAppNavigation();
  const { chrome, isSignedIn } = useExplorerChrome();
  const viewerId = chrome.ownerId;
  const prefs = chrome.prefs;
  const teams = useTokenTeams(isSignedIn);
  const { signInHref } = useAuthHrefs();
  // The welcome's starts load only once Home finds a first run.
  const [welcome, setWelcome] = useState<WelcomeManifest | null>(null);
  const onFirstRun = useCallback(() => {
    void loadWelcome().then(setWelcome);
  }, []);
  const shareHost = useMemo(() => explorerShareHost(viewerId ?? null), [viewerId]);
  const inboxHost = useMemo(() => explorerInboxHost(viewerId ?? null), [viewerId]);
  // The open design deleted from the editor lands here with its Undo (lib/design-delete-undo.ts), taken once.
  const [trashedOnArrival] = useState(arrivedTrashed);
  // The hero's close (docs/specs/013-workspace/explorer-home.md "Hiding the banner"): reported, then written, so
  // every device the person signs in on opens Home without it. Settings > Designs turns it back on.
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
        app="livedesign"
        client={indexClient}
        view={view}
        // The filter field's writes replace the entry, so typing leaves one history entry, not one per pause.
        onNavigate={(_view, href, options) =>
          options?.replace ? router.replace(href) : router.push(href)
        }
        itemHref={itemHref}
        onCreate={(placement) => router.push(newDesignHref(placement))}
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
        heroArt={HERO_ART}
        renderThumbnail={renderDesignThumbnail}
        trashedOnArrival={trashedOnArrival}
        heroHidden={prefs.homeBanner === false}
        onHideHero={hideHero}
        onTimeline={trackTimeline}
        onHome={trackHome}
        onOrganise={trackOrganise}
        onLensSelected={trackLens}
        header={header ? ({ search }) => header(search, chrome) : undefined}
        sidebarLinks={sidebarLinks}
        welcome={{
          manifest: welcome,
          onFirstRun,
          signedIn: isSignedIn,
          signInHref,
          onSelected: trackWelcome,
          onOpened: trackWelcomeOpened,
        }}
      />
      {children?.(chrome)}
    </>
  );
}
