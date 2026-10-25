'use client';

// The Explorer inside a workbench's workspace frame (WorkspaceFrame.tsx): the shared Explorer
// (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md) for the person. The Explorer page itself is
// liveworkspace's, served on this app's own address by its router; a frame keeps its own. Everything it lists comes
// from the index through /api/index; livedocuments supplies the addresses and Help articles
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
  type WelcomeOptions,
} from '@liveworkspace/explorer';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';
import { useAppNavigation } from '@liveworkspace/workbench/hooks/navigation/useAppNavigation';
import { indexClient } from '@/lib/index-client';
import { explorerShareHost } from '@/lib/explorer-share-host';
import { explorerInboxHost } from '@/lib/explorer-inbox-host';
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

// The hero's art draws three template previews; it loads with Home's hero rather than with every Explorer page.
const HeroTemplateFan = lazy(() => import('@/components/panels/home/HeroTemplateFan'));
const HERO_ART = (
  <Suspense fallback={null}>
    <HeroTemplateFan />
  </Suspense>
);

// This Browser: the documents kept only in this browser, which the index never sees, on their own page (/offline).
const SIDEBAR_LINKS: readonly SidebarLink[] = [
  {
    id: 'this-browser',
    label: 'This Browser',
    href: '/offline',
    description: 'Documents kept only in this browser.',
    icon: 'browser',
  },
];

// The welcome manifest as the templates package writes it (its addresses are this site's own), in a chunk of its
// own, fetched once.
type WelcomeFile = Omit<WelcomeManifest, 'name' | 'searchHref'> & { searchHref: string };
let welcomeLoad: Promise<WelcomeManifest> | null = null;
function loadWelcome(): Promise<WelcomeManifest> {
  welcomeLoad ??= import('@livedocuments/templates/welcome.json').then(({ default: raw }) => {
    const file = raw as unknown as WelcomeFile;
    return {
      ...file,
      name: 'livedocuments',
      searchHref: (words: string) => `${file.searchHref}${encodeURIComponent(words)}`,
    };
  });
  welcomeLoad.catch(() => {
    welcomeLoad = null;
  });
  return welcomeLoad;
}

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

// Home's What Happened: literal calls, so the telemetry manifest scan sees each pair.
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

// The Explorer for the person in a workbench's workspace frame (WorkspaceFrame.tsx), which names the view itself and
// catches the Explorer's moves through the app's navigation interceptor. A frame draws the Explorer's own slim search
// bar; a host may hand it a header (`header`) and draw after it (`children`).
export function ExplorerHost({
  view,
  header,
  children,
}: {
  view: ExplorerView;
  header?: (search: ReactNode, chrome: ExplorerChrome) => ReactNode;
  children?: (chrome: ExplorerChrome) => ReactNode;
}) {
  const router = useAppNavigation();
  const { isSignedIn, authLoaded, accountUserId } = useAccountBootstrap();
  const guestId = useSignedGuestId(authLoaded, accountUserId);
  const teams = useTokenTeams(isSignedIn);
  const viewerId = accountUserId ?? guestId;
  const shareHost = useMemo(() => explorerShareHost(viewerId ?? null), [viewerId]);
  const inboxHost = useMemo(() => explorerInboxHost(viewerId ?? null), [viewerId]);
  // The synced preferences (docs/specs/007-editor/user-preferences.md): the device cache at once, the server's
  // copy merged in once the person is known.
  const { userPreferences: prefs } = useEditorPreferences({
    ownerId: viewerId ?? 'self',
    passwordGated: false,
  });
  const chrome: ExplorerChrome = { prefs, ownerId: viewerId ?? null, signedIn: !!accountUserId };
  // The open document deleted from the editor lands here with its Undo (lib/document-delete-undo.ts), taken once.
  const [trashedOnArrival] = useState(arrivedTrashed);
  // The hero's close (docs/specs/013-workspace/explorer-home.md "Hiding the banner"): reported, then written, so
  // every device the person signs in on opens Home without it. Settings > Documents turns it back on.
  const hideHero = useCallback(() => {
    track('UI', 'Toggled', 'HomeBannerOff');
    commitUserPreferences(prefs, { ...prefs, homeBanner: false }, viewerId ?? null);
  }, [prefs, viewerId]);

  // Home's first run (docs/specs/013-workspace/explorer-home.md "First run"): livedocuments' starts, from the templates
  // package's welcome manifest, loaded only once Home finds nothing.
  const [manifest, setManifest] = useState<WelcomeManifest | null>(null);
  const onFirstRun = useCallback(() => {
    void loadWelcome().then(setManifest, () => {});
  }, []);
  const { signInHref } = useAuthHrefs();
  const welcome: WelcomeOptions = useMemo(
    () => ({
      manifest,
      onFirstRun,
      signedIn: !!isSignedIn,
      signInHref,
    }),
    [manifest, onFirstRun, isSignedIn, signInHref],
  );

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
        app="livedocuments"
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
        sidebarLinks={SIDEBAR_LINKS}
        welcome={welcome}
        helpHref={explorerHelpHref}
        heroArt={HERO_ART}
        renderThumbnail={renderDocumentThumbnail}
        trashedOnArrival={trashedOnArrival}
        heroHidden={prefs.homeBanner === false}
        onHideHero={hideHero}
        onTimeline={trackTimeline}
        onHome={trackHome}
        onOrganise={trackOrganise}
        onLensSelected={trackLens}
        header={header ? ({ search }) => header(search, chrome) : undefined}
      />
      {children?.(chrome)}
    </>
  );
}
