import { betterAuth } from 'better-auth';
import { authOptions } from './auth-options.ts';
import { sendCodeEmail } from './email.ts';
import type { Env } from './env.ts';
import { queueWelcome, startLifecycle } from './lifecycle.ts';
import { RESOURCES } from './resources.ts';
import { teamsClaim } from './teams.ts';

function build(env: Env) {
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
            ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
            : null,
        sendCode: (email, code) => sendCodeEmail(env, email, code),
        teamsFor: (userId) => teamsClaim(env.AUTH_DB, userId),
        guestMerge: {
          secure: env.ENVIRONMENT !== 'development',
          indexUrl: env.INDEX_URL,
          indexService: env.INDEX,
          indexMergeKey: env.INDEX_MERGE_KEY,
          db: env.AUTH_DB,
        },
        // The welcome goes once the sign-up's response has (index.ts takeWelcomes).
        onUserCreated: async (user) => {
          if (await startLifecycle(env.AUTH_DB, user)) queueWelcome(user.id);
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
