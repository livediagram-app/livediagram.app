// Signing in without a click on an app's own address (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in without a click"),
// for the Explorer served there (page-app.ts). The apps' editors run the shared boot script in their pages' <head>;
// this page is built once, here, so it carries each app's script behind a check of the address it is on, and runs
// at most one of them: the one for the app whose address it is. On liveworkspace.app none runs (its own session is
// liveworkspace's). Built at build time from @liveworkspace/auth-client/silent: no JavaScript ships for it but the
// inline string.

import { silentCookiesForHint, silentSignInBootScript } from '@liveworkspace/auth-client/silent';
import type { AppName } from '@liveworkspace/sites';
import { appHosts } from './page-app';
import { SIGNED_IN_HINTS } from './app-session';

/** The inline script: `{host: app}` read from the address, then that app's own bounce, with the API on its origin. */
export function explorerSilentSignInScript(): string {
  const hosts = appHosts();
  // Every app whose address the page can be on (appHosts), a held app's too.
  const apps = [...new Set(Object.values(hosts))].flatMap((app: AppName) => {
    const hint = SIGNED_IN_HINTS[app];
    return hint ? [{ app, hint }] : [];
  });
  if (apps.length === 0) return '';
  const branches = apps
    .map(
      ({ app, hint }) =>
        `if(a===${JSON.stringify(app)}){${silentSignInBootScript({
          apiBase: '/api',
          cookies: silentCookiesForHint(hint),
          skipPaths: [],
        })}}`,
    )
    .join('');
  return (
    `(function(){var h=location.host.toLowerCase().replace(/^(?:www|staging)\\./,''),` +
    `a=${JSON.stringify(hosts)}[h];if(!a)return;${branches}})();`
  );
}
