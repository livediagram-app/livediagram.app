'use client';

// The Explorer page: the shared Explorer (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md) in
// liveplanner's chrome, laid out as livediagram's Explorer is: the header with the search field centred between the
// brand and the account, Home's hero under it, and the bottom bar with Search, Settings and Appearance. Everything
// it lists comes from the index through /api/index; liveplanner supplies the addresses and Help articles
// (lib/explorer-host.ts), New (the /new flow), the hero's art (the fanned previews) and its setting (the synced
// `homeBanner` preference, docs/specs/013-workspace/explorer-home.md "Hiding the banner"), and the person: an
// account's teams from its token, or a guest's identity from liveworkspace, which the first visit fetches before the
// Explorer asks for anything.

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import {
  Explorer,
  viewFromLocation,
  type ExplorerView,
  type LensTelemetryType,
  type TimelineTelemetry,
  type HomeTelemetry,
} from '@liveworkspace/explorer';
import { PLAN_TEMPLATE_FAMILIES } from '@/lib/plan-template-families';
import { Brand, SITE_ID, SiteSwitcher } from '@liveplanner/ui';
import { AuthControls } from '@/components/chrome/AuthControls';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { useDismissibleBanner } from '@/hooks/ui/useDismissibleBanner';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { useSearchShortcut } from '@/hooks/ui/useSearchShortcut';
import { manageTeamsUrl, signInEnabled } from '@/lib/auth-config';
import { indexClient } from '@/lib/index-client';
import { isPowerUserMode } from '@/lib/power-user-mode';
import { dropSettingsLink, readSettingsLink } from '@/lib/settings-link';
import { renderPlanThumbnail } from '@/lib/explorer-thumbnail';
import { arrivedTrashed } from '@/lib/project-delete-undo';
import { track } from '@/lib/telemetry';
import { commitUserPreferences, type UserPreferences } from '@/lib/user-preferences';
import {
  explorerHelpHref,
  itemHref,
  newPlanHref,
  shareUrl,
  useTokenTeams,
} from '@/lib/explorer-host';

// The hero's art draws Start Planning's pictures; it loads with Home's hero rather than with every Explorer page.
const HeroFeatureFan = lazy(() => import('@/components/panels/home/HeroFeatureFan'));
const HERO_ART = (
  <Suspense fallback={null}>
    <HeroFeatureFan />
  </Suspense>
);

// Settings mount only while open, so they load on first open rather than with every Explorer page: Settings alone
// carries every category's panes.
const SettingsDialog = dynamic(
  () => import('@/components/dialogs/SettingsDialog').then((m) => m.SettingsDialog),
  { ssr: false },
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

// Home's What Happened: literal calls, so the telemetry manifest scan sees each pair.
const trackHome: HomeTelemetry = (action, type) => {
  switch (action) {
    case 'Selected':
      return track('Home', 'Selected', type);
    case 'Opened':
      return track('Home', 'Opened', type);
  }
};

// The filter lens (docs/specs/013-workspace/explorer-filters.md "Telemetry"): a facet that gained a value, never the
// value. Literal calls, so the telemetry manifest scan sees the pair.
const trackLens = (type: LensTelemetryType) => track('Explorer', 'Selected', type);

/** What the host's chrome around the Explorer needs: the person's synced preferences and whose they are. */
export type ExplorerChrome = { prefs: UserPreferences; ownerId: string | null; signedIn: boolean };

// The Explorer for the person, in whatever frame holds it: the /explorer pages (ExplorerShell) or a workbench's
// workspace frame (app/embed/workbench/WorkspaceFrame.tsx), which names the view itself and catches the Explorer's
// moves through the app's navigation interceptor. A frame draws the Explorer's own slim search bar; the pages hand
// it their header (`header`) and draw their bottom bar and Settings after it (`children`).
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
  // The synced preferences (docs/specs/007-editor/user-preferences.md): the device cache at once, the server's
  // copy merged in once the person is known.
  const { userPreferences: prefs } = useEditorPreferences({
    ownerId: viewerId ?? 'self',
    passwordGated: false,
  });
  const chrome: ExplorerChrome = { prefs, ownerId: viewerId ?? null, signedIn: !!accountUserId };
  // The open plan deleted from the editor lands here with its Undo (lib/project-delete-undo.ts), taken once.
  const [trashedOnArrival] = useState(arrivedTrashed);
  // The hero's close (docs/specs/013-workspace/explorer-home.md "Hiding the banner"): reported, then written, so
  // every device the person signs in on opens Home without it. Settings > Plans turns it back on.
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
        app="liveplanner"
        client={indexClient}
        view={view}
        // The filter field's writes replace the entry, so typing leaves one history entry, not one per pause.
        onNavigate={(_view, href, options) =>
          options?.replace ? router.replace(href) : router.push(href)
        }
        itemHref={itemHref}
        onCreate={(placement) => router.push(newPlanHref(placement))}
        onOpenItem={(href) =>
          href.startsWith('/') ? router.push(href) : window.location.assign(href)
        }
        Link={Link}
        teams={teams}
        viewerId={viewerId}
        shareUrl={shareUrl}
        manageTeamsUrl={isSignedIn ? manageTeamsUrl : undefined}
        helpHref={explorerHelpHref}
        heroArt={HERO_ART}
        renderThumbnail={renderPlanThumbnail}
        trashedOnArrival={trashedOnArrival}
        heroHidden={prefs.homeBanner === false}
        onHideHero={hideHero}
        onTimeline={trackTimeline}
        onHome={trackHome}
        lensTemplates={PLAN_TEMPLATE_FAMILIES}
        onLensSelected={trackLens}
        header={header ? ({ search }) => header(search, chrome) : undefined}
      />
      {children?.(chrome)}
    </>
  );
}

// Search from the bottom bar or Cmd/Ctrl+K: the page's one search field, the header's or Home's hero's.
function focusSearch() {
  const field = document.querySelector<HTMLInputElement>('input[data-search-field]');
  field?.focus();
  field?.select();
}

export function ExplorerShell() {
  const pathname = usePathname();
  const search = useSearchParams();
  const view = viewFromLocation(pathname, search);
  // Opens on the Settings deep link (`?settings=<category>`, lib/settings-link.ts) that mail and the account menu use.
  const [settings, setSettings] = useState<{
    category: string | null;
    section: string | null;
  } | null>(() => readSettingsLink(search.toString()));
  useSearchShortcut(focusSearch);

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-900">
      <ExplorerHost
        view={view}
        header={(field) => (
          // On a desktop the header is three columns, the field centred between the brand and the account on every
          // page; each side grows to its content first. Below `sm` the field wraps onto its own full-width row.
          // pr-0 so the account control sits flush to the right edge.
          <header className="sticky top-0 z-[var(--z-chrome)] flex shrink-0 flex-wrap items-center justify-between gap-x-4 border-y border-slate-200 bg-white/85 pl-4 pr-0 backdrop-blur sm:h-14 sm:flex-nowrap lg:grid lg:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] dark:border-slate-700 dark:bg-slate-900/85">
            <div className="flex h-14 items-center gap-3 lg:col-start-1">
              {/* Hover the logo for liveworkspace's other sites (liveworkspace/docs/site-switcher.md). */}
              <SiteSwitcher current={SITE_ID}>
                <Brand href="/" size="md" />
              </SiteSwitcher>
            </div>
            {/* While Home shows its hero the field sits there instead, so the page never has two. */}
            {field ? (
              <div className="order-last w-full pb-2 pr-4 sm:order-none sm:ml-auto sm:w-auto sm:pb-0 sm:pr-0 lg:col-start-2 lg:ml-0">
                {field}
              </div>
            ) : null}
            <div className="flex h-14 items-stretch lg:col-start-3 lg:justify-self-end">
              <AuthControls
                onOpenAccount={() => setSettings({ category: 'account', section: null })}
              />
            </div>
          </header>
        )}
      >
        {({ prefs, ownerId, signedIn }) => (
          <>
            <GuestSignInBanner signedIn={signedIn} />
            {/* The bottom bar (docs/specs/007-editor/editor-app.md): the editor's right-hand controls, Search,
                Settings and Appearance. The toasts stand on it (docs/specs/004-interface-design/toasts.md). */}
            <div
              data-toast-floor=""
              className="sticky bottom-0 z-[var(--z-chrome)] flex h-12 shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <ChromeControls
                onOpenSearch={focusSearch}
                onOpenSettings={() => setSettings({ category: null, section: null })}
                powerUser={isPowerUserMode(prefs)}
              />
            </div>
            {settings ? (
              <SettingsDialog
                settings={prefs}
                onChange={(next) => {
                  // The row built `next` on this render's preferences; only its change is written, onto the
                  // freshest, so another tab's change since is kept. The cache drives `prefs`.
                  commitUserPreferences(prefs, next, ownerId);
                }}
                onClose={() => {
                  setSettings(null);
                  dropSettingsLink();
                }}
                initialCategoryId={settings.category}
                initialSectionId={settings.section}
              />
            ) : null}
          </>
        )}
      </ExplorerHost>
    </div>
  );
}

// The guest's sign-in banner (docs/specs/014-identity/sign-in-encouragement.md): a floating card over the bottom bar,
// only where sign-in is wired up, for a visitor not signed in (a guest id does not count) who has not closed it. While
// it shows, a spacer lets the last row scroll clear of it.
function GuestSignInBanner({ signedIn }: { signedIn: boolean }) {
  const { dismissed, dismiss } = useDismissibleBanner(SIGNIN_BANNER_DISMISS_KEY);
  if (!signInEnabled || signedIn || dismissed) return null;
  return (
    <>
      <div aria-hidden className="h-28 shrink-0 sm:h-12" />
      <SignInBanner surface="Explorer" onDismiss={dismiss} />
    </>
  );
}
