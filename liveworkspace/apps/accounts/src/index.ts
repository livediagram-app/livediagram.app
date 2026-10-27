import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import { ACCOUNT_API_PATH, handleAccountApi } from './account-api.ts';
import { AUTH_BASE_PATH, SEND_CODE_PATH, SIGN_IN_CODE_PATH } from './auth-options.ts';
import { getAuth, getGoogleAuthFor } from './auth.ts';
import { appOriginOfProxy, signInOnAppAddress } from './handoff.ts';
import { BENCH_ACCOUNTS_PATH, benchAccounts } from './bench-accounts.ts';
import { CLIENTS_PATH, registerClient } from './clients.ts';
import { DELETE_ACCOUNT_PATH, deleteAccount } from './delete-account.ts';
import { MIGRATION_NOTICE_PATH, migrationNotice } from './migration-notice.ts';
import { disconnectDrive, driveDisconnectConfig } from './drive-disconnect.ts';
import {
  END_SESSION_PATH,
  endSessionFromApp,
  endSessionInBrowser,
  endSessionTokensOf,
  SESSION_ENDING_ROUTES,
} from './end-session.ts';
import type { Env } from './env.ts';
import { sweepIdleGuests } from './guest-sweep.ts';
import {
  AUTHORIZE_PATH,
  GUEST_PATH,
  guestHandoff,
  guestMergeConfig,
  mergeGuestOnAuthorize,
} from './guests.ts';
import { indexPurgeConfig, PURGE_RETRY_CRON, retryPendingPurges } from './index-purge.ts';
import { withSessionColour } from './profiles.ts';
import { networkOf, overCodeLimit } from './rate-limit.ts';
import { withOwnCookies } from './own-cookies.ts';

const GET_SESSION_PATH = '/get-session';
import { SIGN_IN_OPTIONS_PATH, signInOptions } from './sign-in-options.ts';
import { sendEmail, sendTeamInviteEmail } from './email.ts';
import { runLifecycle, sendWelcomes, takeWelcomes, type SendEmail } from './lifecycle.ts';
import { sweepInvitations } from './teams.ts';
import { noteExpiringTokens, sweepExpiringTokens } from './token-expiry.ts';
import {
  flushTimeline,
  flushTimelineAfter,
  TIMELINE_CALLS_PER_RUN,
  trimTimelineOutbox,
} from './index-timeline.ts';
import { flushServerEvents, flushServerEventsAfter } from './telemetry.ts';
import { WORKSPACE_TOKEN_PATH, workspaceToken } from './workspace-token.ts';
import { closeAccountWorkbench } from './workbench/revoke.ts';

// The workbench store's Durable Object class, bound as WORKBENCH (wrangler.toml).
export { WorkbenchStore } from './workbench/durable-object.ts';

// The accounts API. Only the paths routed to this Worker reach it (wrangler.toml): /api/auth/*,
// /api/account/* (teams and API tokens, account-api.ts) and the two discovery documents. Every page, the sign-in pages included, is the static site's
// (liveworkspace/apps/site), on the same origin.
export default {
  async fetch(incoming: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(incoming.url);
    const { pathname } = url;
    // Nothing is served without the secret: a key minted under Better Auth's default would break every sign-in
    // once the real one is set (auth.ts getAuth).
    if (!env.BETTER_AUTH_SECRET) {
      console.error('[accounts] BETTER_AUTH_SECRET unset; refusing to serve');
      return Response.json({ error: 'not_configured' }, { status: 503 });
    }
    // A cookie of ours that comes twice (production's on the domain beside staging's own, or a bare host-only copy
    // from before the move to www.) is narrowed to the copy signed here, before anything reads it (own-cookies.ts).
    const request = await withOwnCookies(incoming, env.BETTER_AUTH_SECRET);

    if (request.method === 'GET') {
      if (pathname === `${AUTH_BASE_PATH}${SIGN_IN_OPTIONS_PATH}`) return signInOptions(env);
      if (pathname === `${AUTH_BASE_PATH}${GUEST_PATH}`) {
        if (!(await env.GUEST_LIMITER.limit({ key: `ip:${networkOf(request)}` })).success) {
          return Response.json({ error: 'rate_limited' }, { status: 429 });
        }
        return guestHandoff(request, env, getAuth(env));
      }
      // liveworkspace.app's own Explorer: a short-lived token for the session's account or the browser's guest.
      if (pathname === `${AUTH_BASE_PATH}${WORKSPACE_TOKEN_PATH}`) {
        return workspaceToken(request, env, getAuth(env));
      }
      // Signing out everywhere: the browser's hop through here, back to the app (end-session.ts).
      if (pathname === `${AUTH_BASE_PATH}${END_SESSION_PATH}`) {
        return endSessionInBrowser(request, env, getAuth(env));
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
      const response = await handleAccountApi(request, env, getAuth(env), (promise) =>
        ctx.waitUntil(promise),
      );
      // The team emails it sent are counted after the response (telemetry.ts), and the team and token
      // events it made go to the Timeline (index-timeline.ts).
      flushServerEventsAfter(env, ctx);
      flushTimelineAfter(env, ctx);
      return response;
    }

    if (request.method === 'POST' && pathname === CLIENTS_PATH) {
      return registerClient(request, env, getAuth(env));
    }

    // Signing out everywhere, from an app's Worker: the session its refresh token came from ends (end-session.ts).
    if (request.method === 'POST' && pathname === `${AUTH_BASE_PATH}${END_SESSION_PATH}`) {
      return endSessionFromApp(request, env, getAuth(env));
    }

    if (request.method === 'POST' && pathname === BENCH_ACCOUNTS_PATH) {
      return benchAccounts(request, env);
    }

    // The migration notice (docs/migration.md step 8), behind ADMIN_TOKEN.
    if (request.method === 'POST' && pathname === MIGRATION_NOTICE_PATH) {
      return migrationNotice(request, env);
    }

    if (request.method === 'POST' && pathname === `${AUTH_BASE_PATH}${DELETE_ACCOUNT_PATH}`) {
      return deleteAccount(
        request,
        getAuth(env),
        env.AUTH_DB,
        indexPurgeConfig(env),
        (userId) => closeAccountWorkbench(env, userId, (promise) => ctx.waitUntil(promise)),
        // After the answer: Google's revoke never holds the close up.
        (userId) => ctx.waitUntil(disconnectDrive(driveDisconnectConfig(env), userId)),
        env,
      );
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
      // Google on an app's own address (GOOGLE_ON_APP_ORIGINS): Google sends the browser back to the app's address.
      const googleOrigin =
        env.GOOGLE_ON_APP_ORIGINS === 'true' &&
        (route === '/sign-in/social' || route.startsWith('/callback/google'))
          ? appOriginOfProxy(request, env.ENVIRONMENT)
          : null;
      const auth = googleOrigin ? getGoogleAuthFor(env, googleOrigin) : getAuth(env);
      // liveworkspace.app's own Sign out, and Settings › Security's, end every app's session from the sessions they
      // end too (end-session.ts).
      if (request.method === 'POST' && SESSION_ENDING_ROUTES.has(route)) {
        await endSessionTokensOf(request, route, auth, env.AUTH_DB);
      }
      let response = await auth.handler(request);
      // liveworkspace.app's header learns the account's presence colour with its session (profiles.ts).
      if (request.method === 'GET' && route === GET_SESSION_PATH) {
        response = await withSessionColour(response, env.AUTH_DB);
      }
      // Someone not signed in here yet signs in on the app's own address (handoff.ts).
      if (request.method === 'GET' && route === AUTHORIZE_PATH) {
        response = await signInOnAppAddress(request, response, {
          environment: env.ENVIRONMENT,
          baseUrl: env.BASE_URL,
          enabled: env.SIGN_IN_ON_APP_ORIGINS === 'true',
          db: env.AUTH_DB,
        });
      }
      // A sign-in that found a session already here still takes a guest's things (guests.ts).
      if (request.method === 'GET' && route === AUTHORIZE_PATH) {
        response = await mergeGuestOnAuthorize(
          request,
          response,
          guestMergeConfig(env),
          async (headers) => (await auth.api.getSession({ headers }))?.user.id ?? null,
        );
      }
      // An account made by this request (or another in this isolate) hears its welcome now, after the
      // response, rather than holding the sign-up on the email (lifecycle.ts).
      const welcomes = takeWelcomes();
      if (welcomes.length > 0) {
        ctx.waitUntil(
          sendWelcomes(env.AUTH_DB, env, lifecycleSender(env), welcomes).catch((error: unknown) =>
            console.error('[lifecycle] welcome failed', error),
          ),
        );
      }
      return response;
    }

    return new Response('Not found', { status: 404 });
  },

  // Every 15 minutes (wrangler.toml): closed accounts' purges the index hasn't taken yet are sent
  // again, and welcomes that failed are tried again; once a day the rest of the onboarding series goes
  // (liveworkspace/docs/specs/003-accounts/accounts.md "Onboarding emails"). Once a day as well: team invitations nobody answered expire, and the rest hear their
  // reminders (liveworkspace/docs/specs/003-accounts/accounts.md "Reminders and expiry"); owners of API tokens that expire
  // within a week are warned, once per token, and see it on their Timelines ("API tokens"); and the settings and profiles
  // of guests who can never come back are deleted ("Guests who never come back").
  // Each step is isolated (`step`): one that throws is logged and the run goes on to the next.
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await step('index purges', async () => {
      const purges = await retryPendingPurges(env.AUTH_DB, indexPurgeConfig(env));
      if (purges.sent + purges.failed > 0)
        console.log('[accounts] index purges', JSON.stringify(purges));
    });
    // Every run: Timeline events the index hasn't taken yet go again (index-timeline.ts), the oldest beyond
    // TIMELINE_OUTBOX_MAX dropped first, so the outbox stays bounded with no index or one that is down.
    await step('timeline', async () => {
      const trimmed = await trimTimelineOutbox(env.AUTH_DB);
      if (trimmed > 0)
        console.warn('[accounts] timeline events dropped, over the outbox limit', trimmed);
      const timeline = await flushTimeline(
        env.AUTH_DB,
        indexPurgeConfig(env),
        TIMELINE_CALLS_PER_RUN,
      );
      if (timeline.sent > 0 || timeline.waiting)
        console.log('[accounts] timeline events', JSON.stringify(timeline));
    });
    // Every run: a welcome that failed is tried again within 15 minutes. Once a day: the whole series.
    const daily = controller.cron !== PURGE_RETRY_CRON;
    await step('lifecycle', async () => {
      const lifecycle = await runLifecycle(
        env.AUTH_DB,
        env,
        lifecycleSender(env),
        daily ? undefined : ['welcome'],
      );
      if (daily || (lifecycle.welcome?.sent ?? 0) + (lifecycle.welcome?.failed ?? 0) > 0) {
        console.log('[lifecycle] onboarding emails', JSON.stringify(lifecycle));
      }
    });
    if (!daily) return;
    await step('invitation sweep', async () => {
      const result = await sweepInvitations(env.AUTH_DB, (reminder) =>
        sendTeamInviteEmail(env, {
          to: reminder.to,
          teamName: reminder.teamName,
          inviterName: reminder.inviterName ?? '',
          declineToken: reminder.declineToken,
          stage: reminder.stage,
          app: reminder.inviterApp,
        }),
      );
      console.log('[teams] invitation sweep', JSON.stringify(result));
    });
    try {
      const tokens = await sweepExpiringTokens(env.AUTH_DB, env, (email) => sendEmail(env, email));
      if (tokens.sent + tokens.failed > 0) {
        console.log('[tokens] expiry warnings', JSON.stringify(tokens));
      }
    } catch (error) {
      console.error('[tokens] expiry warning sweep failed', error);
    } finally {
      // Tokens expiring within the week go on their owners' Timelines, then to the index.
      try {
        if ((await noteExpiringTokens(env.AUTH_DB)) > 0) {
          await flushTimeline(env.AUTH_DB, indexPurgeConfig(env), TIMELINE_CALLS_PER_RUN);
        }
      } catch (error) {
        console.error('[tokens] expiry Timeline note failed', error);
      }
      // The reminders and warnings that went, one batch per app once both sweeps are done.
      await step('server events', async () => {
        await flushServerEvents(env);
      });
    }
    // Guests who can never come back: what is kept against their ids goes (src/guest-sweep.ts).
    await step('idle guests', async () => {
      const guests = await sweepIdleGuests(env.AUTH_DB);
      if (guests > 0) console.log('[guests] idle guests swept', guests);
    });
  },
} satisfies ExportedHandler<Env>;

// One cron step: a failure is logged and the run goes on to the next, so one broken step never starves the rest.
async function step(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[accounts] cron step failed: ${name}`, error);
  }
}

const lifecycleSender =
  (env: Env): SendEmail =>
  (email) =>
    sendEmail(env, email);
