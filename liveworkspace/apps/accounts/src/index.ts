import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import { ACCOUNT_API_PATH, handleAccountApi } from './account-api.ts';
import { AUTH_BASE_PATH, SEND_CODE_PATH, SIGN_IN_CODE_PATH } from './auth-options.ts';
import { getAuth } from './auth.ts';
import { CLIENTS_PATH, registerClient } from './clients.ts';
import { DELETE_ACCOUNT_PATH, deleteAccount } from './delete-account.ts';
import type { Env } from './env.ts';
import { GUEST_PATH, guestHandoff } from './guests.ts';
import { overCodeLimit } from './rate-limit.ts';
import { SIGN_IN_OPTIONS_PATH, signInOptions } from './sign-in-options.ts';
import { sendTeamInviteEmail } from './email.ts';
import { sweepInvitations } from './teams.ts';

// The accounts API. Only the paths routed to this Worker reach it (wrangler.toml): /api/auth/*,
// /api/account/* (teams and API tokens, account-api.ts) and the two discovery documents. Every page, the sign-in pages included, is the static site's
// (liveworkspace/apps/site), on the same origin.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'GET') {
      if (pathname === `${AUTH_BASE_PATH}${SIGN_IN_OPTIONS_PATH}`) return signInOptions(env);
      if (pathname === `${AUTH_BASE_PATH}${GUEST_PATH}`) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        if (!(await env.GUEST_LIMITER.limit({ key: `ip:${ip}` })).success) {
          return Response.json({ error: 'rate_limited' }, { status: 429 });
        }
        return guestHandoff(request, env, getAuth(env));
      }
      // Discovery at the root as well as under the issuer path, for clients that only look
      // at the origin (RFC 8414 §3 and OIDC Discovery §4 disagree on where it lives).
      if (pathname === '/.well-known/openid-configuration') {
        return oauthProviderOpenIdConfigMetadata(getAuth(env))(request);
      }
      if (pathname === '/.well-known/oauth-authorization-server') {
        return oauthProviderAuthServerMetadata(getAuth(env))(request);
      }
    }

    if (pathname === ACCOUNT_API_PATH || pathname.startsWith(`${ACCOUNT_API_PATH}/`)) {
      return handleAccountApi(request, env, getAuth(env));
    }

    if (request.method === 'POST' && pathname === CLIENTS_PATH) {
      return registerClient(request, env, getAuth(env));
    }

    if (request.method === 'POST' && pathname === `${AUTH_BASE_PATH}${DELETE_ACCOUNT_PATH}`) {
      return deleteAccount(request, getAuth(env), env.AUTH_DB);
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

  // Once a day (wrangler.toml): team invitations nobody answered expire, and the rest hear their
  // reminders (liveworkspace/docs/accounts.md "Reminders and expiry").
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const result = await sweepInvitations(env.AUTH_DB, (reminder) =>
      sendTeamInviteEmail(env, {
        to: reminder.to,
        teamName: reminder.teamName,
        inviterName: reminder.inviterName ?? '',
        declineToken: reminder.declineToken,
        stage: reminder.stage,
      }),
    );
    console.log('[teams] invitation sweep', JSON.stringify(result));
  },
} satisfies ExportedHandler<Env>;
