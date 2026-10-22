import { betterAuth } from 'better-auth';
import { authOptions } from './auth-options.ts';
import { sendCodeEmail } from './email.ts';
import type { Env } from './env.ts';
import { RESOURCES } from './resources.ts';

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
