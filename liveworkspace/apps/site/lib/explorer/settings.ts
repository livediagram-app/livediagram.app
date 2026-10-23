'use client';

// The person's synced settings the Explorer on liveworkspace.app follows (liveworkspace/docs/accounts.md
// "Settings"): whether anonymous events may be sent (`telemetryEnabled`, the `all` scope every app shares). One read
// per app a page asks about, shared with the account's settings page (lib/app-settings.ts). A guest has no synced
// settings: telemetry then follows the browser.

import { useEffect } from 'react';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { loadAppScopes, type AppId } from '@/lib/app-settings';
import { setExplorerConsent } from './telemetry';

/** `kind`: who the page is for, once known (null while the identity is asked for). */
export function useExplorerSettings(app: AppName, kind: 'account' | 'guest' | null): void {
  const site = APP_ITEMS[app].site as AppId;

  useEffect(() => {
    if (kind === null) return;
    if (kind === 'guest') {
      setExplorerConsent(null);
      return;
    }
    let live = true;
    void loadAppScopes(site).then((result) => {
      if (!live) return;
      // Unread, telemetry stays as the apps default it: on unless turned off.
      const all = result.ok ? result.data.all : {};
      setExplorerConsent(all.telemetryEnabled !== false);
    });
    return () => {
      live = false;
    };
  }, [site, kind]);
}
