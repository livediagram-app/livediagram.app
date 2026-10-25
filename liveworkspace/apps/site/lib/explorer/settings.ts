'use client';

// The person's synced settings the Explorer on liveworkspace.app follows (liveworkspace/docs/accounts.md
// "Settings"): whether Home's banner is hidden (`homeBanner`, a common setting in the `all` scope, an app's copy from
// before it was shared counting until `all` has one) and whether anonymous events may be sent (`telemetryEnabled`,
// the `all` scope too). One read per
// app a page asks about, shared with the Settings panel (lib/app-settings.ts). A guest has no synced
// settings: Home's banner is then this browser's own choice, and telemetry follows the browser.

import { useCallback, useEffect, useState } from 'react';
import { joinSettings } from '@liveworkspace/settings';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import type { AppScopes } from '@liveworkspace/settings-ui';
import { settingsStore, type AppId } from '@/lib/app-settings';
import { setExplorerConsent, trackHomeBannerOff } from './telemetry';

export type ExplorerSettings = {
  // Controlled when known (signed in); undefined lets the Explorer keep the choice in this browser.
  heroHidden: boolean | undefined;
  onHideHero: () => void;
};

/** `kind`: who the page is for, once known (null while the identity is asked for). */
export function useExplorerSettings(
  app: AppName,
  kind: 'account' | 'guest' | null,
): ExplorerSettings {
  const site = APP_ITEMS[app].site as AppId;
  // Kept with the app it was read for, so a page that moves to another app never shows the last one's.
  const [read, setRead] = useState<{ site: AppId; scopes: AppScopes } | null>(null);
  const scopes = read?.site === site ? read.scopes : null;

  useEffect(() => {
    if (kind === null) return;
    if (kind === 'guest') {
      setExplorerConsent(null);
      return;
    }
    let live = true;
    void settingsStore.loadApp(site).then((result) => {
      if (!live) return;
      // Unread, telemetry stays as the apps default it: on unless turned off.
      const all = result.ok ? result.data.all : {};
      setExplorerConsent(all.telemetryEnabled !== false);
      if (result.ok) setRead({ site, scopes: result.data });
    });
    return () => {
      live = false;
    };
  }, [site, kind]);

  const onHideHero = useCallback(() => {
    trackHomeBannerOff();
    if (kind !== 'account') return;
    // Shown hidden at once; written so every device, and every app's Home, opens without it. Any app's Settings
    // turns it back on.
    setRead((now) => {
      if (now?.site !== site) return now;
      const all = { ...now.scopes.all, homeBanner: false };
      settingsStore.rememberShared(all);
      return { site, scopes: { ...now.scopes, all } };
    });
    void settingsStore.patchShared({ homeBanner: false }).then((result) => {
      if (result.ok) settingsStore.rememberShared(result.data.all);
    });
  }, [kind, site]);

  const heroHidden =
    kind === 'account' && scopes
      ? joinSettings(scopes.all, scopes.app).homeBanner === false
      : undefined;
  return { heroHidden, onHideHero };
}
