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

// Longer names are cut to this on the way in; it keeps a name from swamping the apps' layouts.
export const NAME_MAX_LENGTH = 80;

export interface AuthConfig {
  baseUrl: string;
  secret: string;
  resources: string[];
  turnstileSecretKey: string;
  adminToken: string;
  // "Continue with Google", when the Worker has a Google OAuth client.
  google: { clientId: string; clientSecret: string } | null;
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
    // First and last name, as the registration page asks for them. `name` stays the two
    // joined, so anything reading Better Auth's own field shows the whole name.
    user: {
      additionalFields: {
        givenName: { type: 'string', required: false, input: true },
        familyName: { type: 'string', required: false, input: true },
      },
    },
    ...(config.google && {
      socialProviders: {
        google: {
          clientId: config.google.clientId,
          clientSecret: config.google.clientSecret,
          // Someone signed in to several Google accounts picks one rather than getting whichever
          // the browser last used.
          prompt: 'select_account' as const,
          // Google's first and last name fill the account's; its picture is left behind, since
          // the apps show initials.
          mapProfileToUser: (profile) => ({
            givenName: profile.given_name,
            familyName: profile.family_name,
            image: undefined,
          }),
        },
      },
    }),
    // Google verifies the address it hands over, so signing in with Google on an address that
    // already has an account (made with an email code) joins that account rather than failing.
    account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
    databaseHooks: {
      user: {
        create: { before: async (user) => ({ data: withNames(user) }) },
        update: { before: async (user) => ({ data: withNames(user) }) },
      },
    },
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
        // An app sends `prompt=create` from its "Create account" button.
        signup: { page: '/sign-up' },
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
        // The provider sends profile and email claims only from /userinfo. The apps read who
        // signed in from the ID token they already have, so the claims go in it as well.
        customIdTokenClaims: ({ user, scopes }) => idTokenClaims(user, scopes),
      }),
    ],
  } satisfies BetterAuthOptions;
}

async function isAdmin(headers: Headers, adminToken: string): Promise<boolean> {
  const sent = headers.get(ADMIN_HEADER);
  return Boolean(adminToken && sent && (await sameSecret(sent, adminToken)));
}

type NamedUser = { name?: string | null; givenName?: unknown; familyName?: unknown };

const cleanName = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim().slice(0, NAME_MAX_LENGTH) : undefined;

// Trims and caps the names. An update carries only the fields it changes, so `name` is
// rebuilt from the two halves only when both are there.
export function withNames<T extends NamedUser>(user: T): T {
  const givenName = cleanName(user.givenName);
  const familyName = cleanName(user.familyName);
  const name =
    givenName !== undefined && familyName !== undefined
      ? [givenName, familyName].filter(Boolean).join(' ')
      : cleanName(user.name);
  return {
    ...user,
    ...(givenName !== undefined && { givenName }),
    ...(familyName !== undefined && { familyName }),
    ...(name !== undefined && { name }),
  };
}

type ClaimUser = NamedUser & { email: string; emailVerified: boolean };

export function idTokenClaims(user: ClaimUser, scopes: string[]): Record<string, unknown> {
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  return {
    ...(scopes.includes('profile') && {
      name: text(user.name),
      given_name: text(user.givenName),
      family_name: text(user.familyName),
    }),
    ...(scopes.includes('email') && { email: user.email, email_verified: user.emailVerified }),
  };
}
