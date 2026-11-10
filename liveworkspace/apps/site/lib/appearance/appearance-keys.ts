// Whose Appearance setting a page here reads (liveworkspace/docs/specs/010-site/site.md "Behaviour"): on an app's
// address, the key that app's own pages store it under, so the Explorer there is light or dark as the app is; on
// liveworkspace.app, the platform's own. A PLAIN module, deliberately NOT `'use client'`: the root layout is a server
// component and inlines the boot script built here (see @liveworkspace/ui/appearance-storage for why).

import { DARK_MEDIA_QUERY } from '@liveworkspace/ui/appearance-storage';
import type { AppName } from '@liveworkspace/sites';
import { PORT_BLOCK, appHosts, appOfPageHost } from '../explorer/page-app';

// Each app's own key, as its UI package names it (`<app>/packages/ui/src/appearance/appearance-storage.ts`,
// APPEARANCE_STORAGE_KEY; appearance-keys.test.ts pins them to those files). Stored data: never rename one.
export const APP_APPEARANCE_KEYS: Record<AppName, string> = {
  livediagram: 'livediagram:v2:ui-mode',
  liveplanner: 'liveplanner:v2:ui-mode',
  livedocuments: 'livedocuments:v2:ui-mode',
  livedesign: 'livedesign:v2:ui-mode',
  livehuddle: 'livehuddle:v2:ui-mode',
};

// liveworkspace.app's own: the key the site has always read, so no one's pick resets.
export const PLATFORM_APPEARANCE_KEY = APP_APPEARANCE_KEYS.livediagram;

/** The key a page on `host` reads: its app's (locally any port in the app's block), else the platform's. */
export function appearanceKeyForHost(host: string): string {
  const app = appOfPageHost(host);
  return app ? APP_APPEARANCE_KEYS[app] : PLATFORM_APPEARANCE_KEY;
}

/**
 * The pre-paint script: the address's key (one lookup: the bare host, or locally the first port of its block), then
 * the shared rule, 'dark' paints dark, 'light' stays light, anything else follows the device. Wrapped in try/catch so
 * storage being denied never throws past it.
 */
export function siteAppearanceBootScript(): string {
  const keys: Record<string, string> = {};
  for (const [host, app] of Object.entries(appHosts())) keys[host] = APP_APPEARANCE_KEYS[app];
  return (
    `try{var m=${JSON.stringify(keys)},h=location.host.toLowerCase().replace(/^(?:www|staging)\\./,''),` +
    `p=/^(?:localhost|127\\.0\\.0\\.1):(\\d+)$/.exec(h),` +
    `k=m[h]||p&&m['localhost:'+Math.floor(p[1]/${PORT_BLOCK})*${PORT_BLOCK}]||'${PLATFORM_APPEARANCE_KEY}',` +
    `s=localStorage.getItem(k);` +
    `if(s==='dark'||(s!=='light'&&typeof matchMedia==='function'&&matchMedia('${DARK_MEDIA_QUERY}').matches))` +
    `document.documentElement.classList.add('dark')}catch(e){}`
  );
}
