'use client';

// The Explorer's Settings panel (liveworkspace/docs/specs/010-site/site.md "The Explorer"): where it opens in place
// over the Explorer (the bottom bar, the account menu, `?settings=`), for an account or, on an app's address, for a
// guest, and the address dropping `?settings=` as it closes. ExplorerShell draws the panel; this decides it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { useRouter, useSearchParams } from 'next/navigation';
import { siteOfApp, type AppName } from '@liveworkspace/sites';
import { preloadSettingsPanel } from '@liveworkspace/settings-ui';
import { signInHref } from '@/lib/accounts';
import { appSignInHref } from '@/lib/explorer/app-session';
import {
  EXPORT_LINK_PARAM,
  SECTION_PARAM,
  SETTINGS_PARAM,
  settingsOpening,
  type Arrival,
} from '@/lib/explorer/host';
import type { WorkspaceIdentity } from '@/lib/explorer/token';
import { loadCatalogue, type AppId } from '@/lib/app-settings';

// The Settings panel's code: fetched when Settings is pointed at or pressed (or `?settings=` opens it).
export const loadSettings = () => import('@/components/settings/SiteSettingsDialog');

// Where the Settings panel opens: the app it is for (by its site id), the side of the switch, and the category.
export type PanelOpening = {
  app: AppId | null;
  scope: 'app' | 'all' | null;
  categoryId: string | null;
};
const appIdOf = (app: AppName) => siteOfApp(app).id as AppId;

export function useExplorerSettingsPanel({
  arrived,
  host,
  identity,
  signedIn,
  ready,
  searchParams,
  router,
}: {
  arrived: Arrival;
  host: AppName | null;
  identity: WorkspaceIdentity | null;
  signedIn: boolean;
  ready: boolean;
  searchParams: ReturnType<typeof useSearchParams>;
  router: ReturnType<typeof useRouter>;
}) {
  // The account's settings, for a person signed in: the Settings panel in place over the Explorer (the bottom bar, the
  // account menu, `?settings=`), opened for the app the person came from (its settings, All one click away), or on
  // All from no app. Never a page of its own, and never another address.
  const [settingsAt, setSettingsAt] = useState<PanelOpening | null>(null);
  const settingsApp: AppId | null = arrived.app ? appIdOf(arrived.app) : null;
  // A guest's settings, on an app's address only: the app's, as its editor keeps them in this browser (this origin's
  // storage). liveworkspace.app can't read them, and keeps no device settings of its own beyond Appearance, which is
  // on the bar already, so a guest there gets no Settings.
  const guestSettingsApp: AppId | null = host && identity?.kind === 'guest' ? appIdOf(host) : null;
  const hasSettings = signedIn || guestSettingsApp !== null;
  const openSettings = useCallback(
    () => setSettingsAt({ app: settingsApp, scope: null, categoryId: null }),
    [settingsApp],
  );
  const prepareSettings = useCallback(() => {
    void loadSettings();
    preloadSettingsPanel();
    if (settingsApp) void loadCatalogue(settingsApp);
  }, [settingsApp]);
  const settingsControl = useMemo(
    () => (hasSettings ? { onOpen: openSettings, onPrepare: prepareSettings } : null),
    [hasSettings, openSettings, prepareSettings],
  );
  // `?settings=<section>` (an email's link, the old /account/settings, a Search result, an editor's account menu): the
  // panel opens in place on that section once the page knows who is here, on arrival or on a move inside the
  // Explorer, and the address drops it as the panel closes. An Account section needs an account: a guest signs in and
  // comes back to the same address; on an app's address a guest's app side is the guest's own panel.
  const settingsParam = searchParams.get(SETTINGS_PARAM);
  // `&section=cloud-sync`: a section of that category to scroll to (Cloud Sync's way back from Google).
  const settingsSection = searchParams.get(SECTION_PARAM);
  const asked = useMemo(
    () => (ready && identity ? settingsOpening(settingsParam, arrived.app) : null),
    [ready, identity, settingsParam, arrived.app],
  );
  // What the address opens for whoever is here: null where they would have to sign in first.
  const askedFor = useMemo<PanelOpening | null>(() => {
    if (asked === null || asked === 'teams' || !identity) return null;
    if (identity.kind === 'account')
      return {
        app: asked.app ? appIdOf(asked.app) : null,
        scope: asked.scope,
        categoryId: asked.categoryId,
      };
    return host && asked.scope === 'app'
      ? { app: appIdOf(host), scope: 'app', categoryId: null }
      : null;
  }, [asked, identity, host]);
  useEffect(() => {
    if (asked === 'teams') router.replace('/explorer/invites');
    else if (asked && !askedFor) {
      const here = window.location.pathname + window.location.search;
      window.location.assign(host ? appSignInHref(here) : signInHref(here));
    }
  }, [asked, askedFor, host, router]);
  const shownSettings = settingsAt ?? askedFor;
  const closeSettings = useCallback(() => {
    setSettingsAt(null);
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SETTINGS_PARAM) && !url.searchParams.has(SECTION_PARAM)) return;
    url.searchParams.delete(SETTINGS_PARAM);
    url.searchParams.delete(SECTION_PARAM);
    url.searchParams.delete(EXPORT_LINK_PARAM);
    window.history.replaceState(null, '', url);
  }, []);

  return {
    settingsAt,
    settingsSection,
    guestSettingsApp,
    hasSettings,
    openSettings,
    prepareSettings,
    settingsControl,
    shownSettings,
    closeSettings,
  };
}
