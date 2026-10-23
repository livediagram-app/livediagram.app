import { betterAuth } from 'better-auth';
import { authOptions } from './auth-options.ts';
import { clientApp } from './clients.ts';
import { sendCodeEmail } from './email.ts';
import type { Env } from './env.ts';
import { guestMergeConfig, mergeGuestOfRequest } from './guests.ts';
import { ACCOUNTS_ON_APP_PATH } from '@liveworkspace/sites/workspace-proxy';
import { APP_SITES, appOrigins, type AppEnvironment, type AppSiteId } from '@liveworkspace/sites';
import { queueWelcome, startLifecycle } from './lifecycle.ts';
import { RESOURCES } from './resources.ts';
import { teamsClaim } from './teams.ts';

function build(env: Env, googleRedirectURI?: string) {
  return betterAuth(
    authOptions(
      {
        baseUrl: env.BASE_URL,
        secret: env.BETTER_AUTH_SECRET,
        resources: RESOURCES[env.ENVIRONMENT],
        turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
        adminToken: env.ADMIN_TOKEN,
        google:
          env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
            ? {
                clientId: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
                redirectURI: googleRedirectURI,
              }
            : null,
        appOrigins: allAppOrigins(env.ENVIRONMENT),
        handoff: {
          environment: env.ENVIRONMENT,
          db: env.AUTH_DB,
          mergeGuest: (request, userId) =>
            mergeGuestOfRequest(
              { ...guestMergeConfig(env), secret: env.BETTER_AUTH_SECRET },
              request,
              userId,
            ),
        },
        sendCode: (email, code) => sendCodeEmail(env, email, code),
        teamsFor: (userId) => teamsClaim(env.AUTH_DB, userId),
        guestMerge: guestMergeConfig(env),
        // The welcome goes once the sign-up's response has (index.ts takeWelcomes), speaking for the app
        // the sign-up came through: its OAuth client's, or liveworkspace.app's for the site's own.
        onUserCreated: async (user, { clientId }) => {
          const app = clientId ? await clientApp(env.AUTH_DB, clientId) : 'liveworkspace.app';
          if (await startLifecycle(env.AUTH_DB, user, Date.now(), app)) queueWelcome(user.id);
        },
      },
      env.AUTH_DB,
    ),
  );
}

export type Auth = ReturnType<typeof build>;

// `env` is the same object for the life of an isolate, so the instance (plugin setup,
// schema, resource seeding) is built once per isolate rather than once per request.
let cached: { env: Env; auth: Auth } | null = null;

export function getAuth(env: Env): Auth {
  if (cached?.env !== env) cached = { env, auth: build(env) };
  return cached.auth;
}

/** Every app's origins in this environment: where the sign-in pages may call from (handoff.ts). */
export function allAppOrigins(environment: AppEnvironment): string[] {
  return APP_SITES.flatMap((site) => appOrigins(site.id as AppSiteId, environment));
}

// Google on an app's address (GOOGLE_ON_APP_ORIGINS): the same instance but for where Google sends the browser back,
// the app's own /api/workspace/auth/callback/google, which its router brings here. One per app origin, built on first
// use in an isolate, at most a dozen.
let googleCached: { env: Env; byOrigin: Map<string, Auth> } | null = null;

export function getGoogleAuthFor(env: Env, appOrigin: string): Auth {
  if (googleCached?.env !== env) googleCached = { env, byOrigin: new Map() };
  let auth = googleCached.byOrigin.get(appOrigin);
  if (!auth) {
    auth = build(env, `${appOrigin}${ACCOUNTS_ON_APP_PATH}/callback/google`);
    googleCached.byOrigin.set(appOrigin, auth);
  }
  return auth;
}
