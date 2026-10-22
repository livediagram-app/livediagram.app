import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import { AUTH_BASE_PATH, SEND_CODE_PATH, SIGN_IN_CODE_PATH } from './auth-options.ts';
import { getAuth } from './auth.ts';
import { registerClient } from './clients.ts';
import { DELETE_ACCOUNT_PATH, deleteAccount } from './delete-account.ts';
import type { Env } from './env.ts';
import {
  CONSENT_SCRIPT,
  consentPage,
  SIGN_IN_SCRIPT,
  signInPage,
  signUpPage,
  STYLES,
} from './pages.ts';
import { overCodeLimit } from './rate-limit.ts';

const ASSETS: Record<string, { body: string; type: string }> = {
  '/accounts-assets/accounts.css': { body: STYLES, type: 'text/css; charset=utf-8' },
  '/accounts-assets/sign-in.js': { body: SIGN_IN_SCRIPT, type: 'text/javascript; charset=utf-8' },
  '/accounts-assets/consent.js': { body: CONSENT_SCRIPT, type: 'text/javascript; charset=utf-8' },
};

function asset(path: string): Response | null {
  const found = ASSETS[path];
  if (!found) return null;
  return new Response(found.body, {
    headers: {
      'content-type': found.type,
      // Short: the files are unversioned, and a deploy should reach the page within minutes.
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
    },
  });
}

function pageOptions(env: Env) {
  return {
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  };
}

// Only the paths routed to this Worker reach it (wrangler.toml): it shares liveworkspace.app with
// the marketing site, so it has no / of its own.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'GET') {
      if (pathname === '/sign-in') return signInPage(pageOptions(env));
      if (pathname === '/sign-up') return signUpPage(pageOptions(env));
      if (pathname === '/consent') return consentPage();
      const file = asset(pathname);
      if (file) return file;
      // Discovery at the root as well as under the issuer path, for clients that only look
      // at the origin (RFC 8414 §3 and OIDC Discovery §4 disagree on where it lives).
      if (pathname === '/.well-known/openid-configuration') {
        return oauthProviderOpenIdConfigMetadata(getAuth(env))(request);
      }
      if (pathname === '/.well-known/oauth-authorization-server') {
        return oauthProviderAuthServerMetadata(getAuth(env))(request);
      }
    }

    if (request.method === 'POST' && pathname === '/internal/clients') {
      return registerClient(request, env, getAuth(env));
    }

    if (request.method === 'POST' && pathname === `${AUTH_BASE_PATH}${DELETE_ACCOUNT_PATH}`) {
      return deleteAccount(request, getAuth(env));
    }

    if (pathname === AUTH_BASE_PATH || pathname.startsWith(`${AUTH_BASE_PATH}/`)) {
      const route = pathname.slice(AUTH_BASE_PATH.length);
      if (
        request.method === 'POST' &&
        (route === SEND_CODE_PATH || route === SIGN_IN_CODE_PATH) &&
        (await overCodeLimit(request, env, route === SEND_CODE_PATH))
      ) {
        return Response.json(
          { code: 'RATE_LIMITED', message: 'Too many requests' },
          { status: 429 },
        );
      }
      return getAuth(env).handler(request);
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
