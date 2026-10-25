'use client';

// Settings changed on liveworkspace.app, counted for the app they belong to (liveworkspace/docs/telemetry.md "The
// Explorer on liveworkspace.app"): each change once, where it was made. A change in an app's own Settings is the
// app's to report; one made here is reported here, with the event the app's Settings would have sent (its catalogue,
// @liveworkspace/settings), so the app's settings cards count both.
//
// - In an app's dialog: the row's own event, in that app's name.
// - In the Settings panel's Account section, a switch every app shares (the `all` scope): in the name of the app the page was opened
//   for (`?app=`), with that app's event for the switch. Opened on its own, the page speaks for every app, so the
//   change counts once, in liveworkspace.app's name, with the event the first app that has the switch reports.
import {
  settingChangeEvent,
  sharedToggleEvent,
  type CatalogueBinding,
  type StoredValue,
} from '@liveworkspace/settings/catalogue';
import { PLATFORM_TELEMETRY_APP } from '@liveworkspace/telemetry';
import { APP_SITES } from '@liveworkspace/sites';
import { appFromParam, isAppId, loadCatalogue, type AppId } from './app-settings';
import { trackSetting } from './explorer/telemetry';

export function reportAppSetting(app: AppId, binding: CatalogueBinding, stored: StoredValue): void {
  const event = settingChangeEvent(binding, stored);
  if (event) trackSetting(app, event);
}

/** The app the settings page was opened for, if any. */
export function settingsPageApp(): AppId | null {
  if (typeof window === 'undefined') return null;
  return appFromParam(new URLSearchParams(window.location.search).get('app'));
}

/** A shared switch flipped in the Settings panel, opened for `app` (else the app the page's `?app=` names). Resolves
 *  once the event is handed over (the app's catalogue is loaded on the first one, then kept), so a caller can turn
 *  telemetry off only after its own opt-out is sent. */
export async function reportSharedSetting(
  key: string,
  next: boolean,
  openedFor: AppId | null = settingsPageApp(),
): Promise<void> {
  const app = openedFor;
  if (app) {
    const catalogue = await loadCatalogue(app).catch(() => null);
    const event = catalogue && sharedToggleEvent(catalogue, key, next);
    if (event) trackSetting(app, event);
    return;
  }
  // For every app: once, in liveworkspace.app's name. Catalogues load one at a time until one has the switch.
  for (const site of APP_SITES) {
    if (!isAppId(site.id)) continue;
    const catalogue = await loadCatalogue(site.id).catch(() => null);
    const event = catalogue && sharedToggleEvent(catalogue, key, next);
    if (event) return trackSetting(PLATFORM_TELEMETRY_APP, event);
  }
}
