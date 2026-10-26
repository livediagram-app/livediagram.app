// Signing in without a click on an app's own address (liveworkspace/docs/specs/003-accounts/accounts.md "Signing in without a click"),
// for the Explorer served there (page-app.ts). The apps' editors run the shared boot script in their pages' <head>;
// this page is built once, here, so it carries each app's script behind a check of the address it is on, and runs
// at most one of them: the one for the app whose address it is. On liveworkspace.app none runs (its own session is
// liveworkspace's). Built at build time from @liveworkspace/auth-client/silent: no JavaScript ships for it but the
// inline string.

import { silentCookiesForHint, silentSignInBootScript } from '@liveworkspace/auth-client/silent';
import { APP_NAMES } from '@liveworkspace/sites';
import { appHosts } from './page-app';
import { SIGNED_IN_HINTS } from './app-session';

/** The inline script: `{host: app}` read from the address, then that app's own bounce, with the API on its origin. */
export function explorerSilentSignInScript(): string {
  const hosts = appHosts();
  const apps = APP_NAMES.filter((app) => Object.values(hosts).includes(app));
  if (apps.length === 0) return '';
  const branches = apps
    .map(
      (app) =>
        `if(a===${JSON.stringify(app)}){${silentSignInBootScript({
          apiBase: '/api',
          cookies: silentCookiesForHint(SIGNED_IN_HINTS[app]),
          skipPaths: [],
        })}}`,
    )
    .join('');
  return (
    `(function(){var h=location.host.toLowerCase().replace(/^(?:www|staging)\\./,''),` +
    `a=${JSON.stringify(hosts)}[h];if(!a)return;${branches}})();`
  );
}
