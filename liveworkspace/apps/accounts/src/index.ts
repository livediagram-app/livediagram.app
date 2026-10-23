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
import { sweepIdleGuests } from './guest-sweep.ts';
import {
  AUTHORIZE_PATH,
  GUEST_PATH,
  guestHandoff,
  guestMergeConfig,
  mergeGuestOnAuthorize,
} from './guests.ts';
import { indexPurgeConfig, PURGE_RETRY_CRON, retryPendingPurges } from './index-purge.ts';
import { overCodeLimit } from './rate-limit.ts';
import { SIGN_IN_OPTIONS_PATH, signInOptions } from './sign-in-options.ts';
import { sendEmail, sendTeamInviteEmail } from './email.ts';
import { runLifecycle, sendWelcomes, takeWelcomes, type SendEmail } from './lifecycle.ts';
import { sweepInvitations } from './teams.ts';
import { noteExpiringTokens, sweepExpiringTokens } from './token-expiry.ts';
import { flushTimeline, flushTimelineAfter, TIMELINE_CALLS_PER_RUN } from './index-timeline.ts';
import { flushServerEvents, flushServerEventsAfter } from './telemetry.ts';
import { WORKSPACE_TOKEN_PATH, workspaceToken } from './workspace-token.ts';

// The accounts API. Only the paths routed to this Worker reach it (wrangler.toml): /api/auth/*,
// /api/account/* (teams and API tokens, account-api.ts) and the two discovery documents. Every page, the sign-in pages included, is the static site's
// (liveworkspace/apps/site), on the same origin.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      // liveworkspace.app's own Explorer: a short-lived token for the session's account or the browser's guest.
      if (pathname === `${AUTH_BASE_PATH}${WORKSPACE_TOKEN_PATH}`) {
        return workspaceToken(request, env, getAuth(env));
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
      const response = await handleAccountApi(request, env, getAuth(env));
      // The team emails it sent are counted after the response (telemetry.ts), and the team and token
      // events it made go to the Timeline (index-timeline.ts).
      flushServerEventsAfter(env, ctx);
      flushTimelineAfter(env, ctx);
      return response;
    }

    if (request.method === 'POST' && pathname === CLIENTS_PATH) {
      return registerClient(request, env, getAuth(env));
    }

    if (request.method === 'POST' && pathname === `${AUTH_BASE_PATH}${DELETE_ACCOUNT_PATH}`) {
      return deleteAccount(request, getAuth(env), env.AUTH_DB, indexPurgeConfig(env));
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
      const auth = getAuth(env);
      let response = await auth.handler(request);
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
  // (liveworkspace/docs/accounts.md "Onboarding emails"). Once a day as well: team invitations nobody answered expire, and the rest hear their
  // reminders (liveworkspace/docs/accounts.md "Reminders and expiry"); owners of API tokens that expire
  // within a week are warned, once per token, and see it on their Timelines ("API tokens"); and the settings and profiles
  // of guests who can never come back are deleted ("Guests who never come back").
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const purges = await retryPendingPurges(env.AUTH_DB, indexPurgeConfig(env));
    if (purges.sent + purges.failed > 0)
      console.log('[accounts] index purges', JSON.stringify(purges));
    // Every run: Timeline events the index hasn't taken yet go again (index-timeline.ts).
    const timeline = await flushTimeline(
      env.AUTH_DB,
      indexPurgeConfig(env),
      TIMELINE_CALLS_PER_RUN,
    );
    if (timeline.sent > 0 || timeline.waiting)
      console.log('[accounts] timeline events', JSON.stringify(timeline));
    // Every run: a welcome that failed is tried again within 15 minutes. Once a day: the whole series.
    const daily = controller.cron !== PURGE_RETRY_CRON;
    const lifecycle = await runLifecycle(
      env.AUTH_DB,
      env,
      lifecycleSender(env),
      daily ? undefined : ['welcome'],
    );
    if (daily || (lifecycle.welcome?.sent ?? 0) + (lifecycle.welcome?.failed ?? 0) > 0) {
      console.log('[lifecycle] onboarding emails', JSON.stringify(lifecycle));
    }
    if (!daily) return;
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
      await flushServerEvents(env);
    }
    // Guests who can never come back: what is kept against their ids goes (src/guest-sweep.ts).
    const guests = await sweepIdleGuests(env.AUTH_DB);
    if (guests > 0) console.log('[guests] idle guests swept', guests);
  },
} satisfies ExportedHandler<Env>;

const lifecycleSender =
  (env: Env): SendEmail =>
  (email) =>
    sendEmail(env, email);
