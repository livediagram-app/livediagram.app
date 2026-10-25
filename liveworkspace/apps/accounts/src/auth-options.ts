// Everything Better Auth is configured with, apart from where the database lives. Kept
// free of Worker bindings so scripts/generate-migration.ts can build the same schema
// against an in-memory SQLite.
import { getOAuthProviderState, oauthProvider } from '@better-auth/oauth-provider';
import type { BetterAuthOptions } from 'better-auth';
import { getOAuthState } from 'better-auth/api';
import { captcha, emailOTP, jwt } from 'better-auth/plugins';
import { type MergeConfig, mergeGuestOnSignIn } from './guests.ts';
import { handoffPlugin, type HandoffPluginConfig } from './handoff.ts';
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
  // "Continue with Google", when the Worker has a Google OAuth client. `redirectURI` is where Google sends the browser
  // back: this Worker's own callback unless it names one on an app's address (index.ts googleAuthFor).
  google: { clientId: string; clientSecret: string; redirectURI?: string } | null;
  // The apps' own origins, whose sign-in pages call this Worker through their routers (handoff.ts). Left out where
  // there are none, as when generating the schema.
  appOrigins?: string[];
  // The hand-off that brings a session made on an app's address here (handoff.ts).
  handoff?: HandoffPluginConfig;
  sendCode: (email: string, code: string) => Promise<void>;
  // The teams an account is in, for its access tokens (teams.ts teamsClaim). Left out where there is
  // no database to ask, as when generating the schema.
  teamsFor?: (userId: string) => Promise<{ id: string; name: string; role: string }[]>;
  // The account's presence colour (profiles.ts), for the ID token's `presence_color` claim. Left out
  // where there is no database to ask, as when generating the schema.
  colourFor?: (userId: string) => Promise<string | null>;
  // Telling the index when a guest signs in (guests.ts). Left out where there is no index, as when
  // generating the schema.
  guestMerge?: Omit<MergeConfig, 'secret'>;
  // A new account starts its onboarding series (lifecycle.ts), told which OAuth client the sign-up came
  // through (null for one on liveworkspace.app itself). Left out where there is no database, as when
  // generating the schema. A failure is logged and never fails the sign-up.
  onUserCreated?: (
    user: { id: string; email: string },
    via: { clientId: string | null },
  ) => Promise<void>;
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
    // The sign-in pages on each app's own address (handoff.ts) post here through the app's router.
    trustedOrigins: config.appOrigins ?? [],
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
          ...(config.google.redirectURI && { redirectURI: config.google.redirectURI }),
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
        create: {
          before: async (user) => ({ data: withNames(user) }),
          after: async (user) => {
            if (!config.onUserCreated) return;
            await signUpClientId()
              .then((clientId) => config.onUserCreated?.(user, { clientId }))
              .catch((error: unknown) =>
                console.error('Starting the onboarding series failed:', error),
              );
          },
        },
        update: { before: async (user) => ({ data: withNames(user) }) },
      },
      session: {
        create: {
          after: async (session, ctx) => {
            if (!config.guestMerge) return;
            await mergeGuestOnSignIn(
              { ...config.guestMerge, secret: config.secret },
              session.userId,
              ctx,
            );
          },
        },
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
      ...(config.handoff ? [handoffPlugin(config.handoff)] : []),
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
        // Only our own apps are clients, registered through POST /api/auth/internal/clients. Left at
        // the default, any signed-in account could register an OAuth client of its own (with
        // its own redirect URIs) through /oauth2/create-client, so every client and resource
        // action needs the admin token.
        clientPrivileges: ({ headers }) => isAdmin(headers, config.adminToken),
        resourcePrivileges: ({ headers }) => isAdmin(headers, config.adminToken),
        // Clients belong to liveworkspace, not to whichever account registered them, so
        // deleting an account never takes an app's client with it.
        clientReference: () => 'liveworkspace',
        // The account's teams ride in the token too (liveworkspace/docs/accounts.md "Teams"): an app
        // compares them with its own copy and catches up when they differ, at no cost per request.
        customAccessTokenClaims: async ({ user }) =>
          user
            ? {
                email: user.email,
                email_verified: user.emailVerified,
                ...(config.teamsFor && { teams: await config.teamsFor(user.id) }),
              }
            : {},
        // The provider sends profile and email claims only from /userinfo. The apps read who
        // signed in from the ID token they already have, so the claims go in it as well.
        // The profile's presence colour rides beside the names (one primary-key read per token), so
        // each app's header paints the avatar in it (liveworkspace/docs/accounts.md "An app's
        // signed-in cookies"). A failed read leaves it out rather than failing the token.
        customIdTokenClaims: async ({ user, scopes }) =>
          idTokenClaims(
            user,
            scopes,
            scopes.includes('profile') && config.colourFor
              ? await config.colourFor(user.id).catch(() => null)
              : null,
          ),
      }),
    ],
  } satisfies BetterAuthOptions;
}

// The OAuth client a sign-up came through: the `client_id` of the app's authorize request, which the
// sign-in page sends back as the signed `oauth_query` (the provider checks its signature before the
// endpoint runs). An email code sign-up carries it in its own request; a Google one carries it across
// the trip to Google in the provider's server context. Null for a sign-up on liveworkspace.app itself.
export async function signUpClientId(): Promise<string | null> {
  const query =
    (await getOAuthProviderState().catch(() => null))?.query ??
    (await getOAuthState().catch(() => null))?.serverContext?.query;
  if (typeof query !== 'string') return null;
  return new URLSearchParams(query).get('client_id') || null;
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

// `colour`: the profile's presence colour (profiles.ts), a claim of the profile scope beside the names.
export function idTokenClaims(
  user: ClaimUser,
  scopes: string[],
  colour: string | null = null,
): Record<string, unknown> {
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  return {
    ...(scopes.includes('profile') && {
      name: text(user.name),
      given_name: text(user.givenName),
      family_name: text(user.familyName),
      ...(colour && { presence_color: colour }),
    }),
    ...(scopes.includes('email') && { email: user.email, email_verified: user.emailVerified }),
  };
}
