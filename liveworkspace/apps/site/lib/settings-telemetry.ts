'use client';

// Settings changed on liveworkspace.app, counted for the app they belong to (liveworkspace/docs/telemetry.md "The
// Explorer on liveworkspace.app"): each change once, where it was made. A change in an app's own Settings is the
// app's to report; one made here is reported here, with the event the app's Settings would have sent (its catalogue,
// @liveworkspace/settings), so the app's settings cards count both.
//
// - In an app's dialog: the row's own event, in that app's name.
// - On the settings page, a switch every app shares (the `all` scope): in the name of the app the page was opened
//   for (`?app=`), with that app's event for the switch. Opened on its own, the page speaks for no app, and the
//   change isn't counted.
import {
  settingChangeEvent,
  sharedToggleEvent,
  type CatalogueBinding,
  type StoredValue,
} from '@liveworkspace/settings/catalogue';
import { appFromParam, loadCatalogue, type AppId } from './app-settings';
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

/** A shared switch flipped on the settings page. Resolves once the event is handed over (the app's catalogue is
 *  loaded on the first one, then kept), so a caller can turn telemetry off only after its own opt-out is sent. */
export async function reportSharedSetting(key: string, next: boolean): Promise<void> {
  const app = settingsPageApp();
  if (!app) return;
  const catalogue = await loadCatalogue(app).catch(() => null);
  const event = catalogue && sharedToggleEvent(catalogue, key, next);
  if (event) trackSetting(app, event);
}
