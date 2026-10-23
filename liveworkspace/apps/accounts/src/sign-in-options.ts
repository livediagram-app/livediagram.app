// What the sign-in pages need to know about this deployment. The pages are static files on
// liveworkspace.app (liveworkspace/apps/site), the same for production and staging, so they ask the
// Worker on load rather than have it baked in: the Turnstile site key, whether Google sign-in is
// configured (the button only shows when it would work), and the name length the Worker keeps.
import { NAME_MAX_LENGTH } from './auth-options.ts';
import type { Env } from './env.ts';

export const SIGN_IN_OPTIONS_PATH = '/sign-in-options';

export interface SignInOptions {
  turnstileSiteKey: string;
  google: boolean;
  nameMaxLength: number;
  // Where this Worker and its own sign-in pages are: a page served under an app's address sends Google there while
  // Google can't come back to the app's address.
  accountsUrl: string;
  // Whether Google can come back to an app's own address (GOOGLE_ON_APP_ORIGINS).
  googleOnApps: boolean;
}

export function signInOptions(env: Env): Response {
  const options: SignInOptions = {
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    nameMaxLength: NAME_MAX_LENGTH,
    accountsUrl: env.BASE_URL,
    googleOnApps: env.GOOGLE_ON_APP_ORIGINS === 'true',
  };
  return Response.json(options, {
    // Public and the same for everyone; a config change reaches the pages within minutes.
    headers: { 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' },
  });
}
