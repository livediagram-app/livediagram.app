// Everything Better Auth is configured with, apart from where the database lives. Kept
// free of Worker bindings so scripts/generate-migration.ts can build the same schema
// against an in-memory SQLite.
import { oauthProvider } from '@better-auth/oauth-provider';
import type { BetterAuthOptions } from 'better-auth';
import { captcha, emailOTP, jwt } from 'better-auth/plugins';
import { newUserId } from './ids.ts';
import { ADMIN_HEADER, sameSecret } from './secrets.ts';

export const AUTH_BASE_PATH = '/api/auth';
export const SEND_CODE_PATH = '/email-otp/send-verification-otp';
export const SIGN_IN_CODE_PATH = '/sign-in/email-otp';

export interface AuthConfig {
  baseUrl: string;
  secret: string;
  resources: string[];
  turnstileSecretKey: string;
  adminToken: string;
  sendCode: (email: string, code: string) => Promise<void>;
}

export function authOptions(config: AuthConfig, database: BetterAuthOptions['database']) {
  return {
    appName: 'liveworkspace',
    baseURL: config.baseUrl,
    basePath: AUTH_BASE_PATH,
    secret: config.secret,
    database,
    // The jwt plugin's own /token hands a session JWT to any signed-in browser. Apps get
    // their tokens from /oauth2/token instead, so this one stays off.
    disabledPaths: ['/token'],
    // The Worker's CODE_*_LIMITER bindings do this job (src/index.ts). Better Auth's
    // limiter keeps its counts in isolate memory here, which an attacker spreads across.
    rateLimit: { enabled: false },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      database: {
        generateId: ({ model }) => (model === 'user' ? newUserId() : crypto.randomUUID()),
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp, type }) {
          // Sign-in is the only flow here: there are no passwords to reset, and signing in
          // with a code is what verifies the address.
          if (type !== 'sign-in') return;
          await config.sendCode(email, otp);
        },
      }),
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: config.turnstileSecretKey,
        endpoints: [SEND_CODE_PATH],
      }),
      jwt(),
      oauthProvider({
        loginPage: '/sign-in',
        consentPage: '/consent',
        scopes: ['openid', 'profile', 'email', 'offline_access'],
        resources: config.resources,
        // Refresh tokens rotate on every use. Two tabs of the same app refreshing at once would
        // otherwise race, and the loser would be signed out; within this window a rotated token
        // replays the same response instead.
        refreshTokenReuseInterval: 30,
        // The apps' Teams features match invites against a verified email, and every
        // request carries the access token, so the email rides in it rather than costing
        // a /userinfo call.
        // Only our own apps are clients, registered through POST /internal/clients. Left at
        // the default, any signed-in account could register an OAuth client of its own (with
        // its own redirect URIs) through /oauth2/create-client, so every client and resource
        // action needs the admin token.
        clientPrivileges: ({ headers }) => isAdmin(headers, config.adminToken),
        resourcePrivileges: ({ headers }) => isAdmin(headers, config.adminToken),
        // Clients belong to liveworkspace, not to whichever account registered them, so
        // deleting an account never takes an app's client with it.
        clientReference: () => 'liveworkspace',
        customAccessTokenClaims: ({ user }) =>
          user ? { email: user.email, email_verified: user.emailVerified } : {},
      }),
    ],
  } satisfies BetterAuthOptions;
}

async function isAdmin(headers: Headers, adminToken: string): Promise<boolean> {
  const sent = headers.get(ADMIN_HEADER);
  return Boolean(adminToken && sent && (await sameSecret(sent, adminToken)));
}
