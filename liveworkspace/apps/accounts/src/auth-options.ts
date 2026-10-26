// Everything Better Auth is configured with, apart from where the database lives. Kept
// free of Worker bindings so scripts/generate-migration.ts can build the same schema
// against an in-memory SQLite.
import { getOAuthProviderState, oauthProvider } from '@better-auth/oauth-provider';
import type { BetterAuthOptions } from 'better-auth';
import { getOAuthState } from 'better-auth/api';
import { captcha, emailOTP, jwt } from 'better-auth/plugins';
import { profilePictureOf } from '@liveworkspace/sites/picture';
import { type MergeConfig, mergeGuestOnSignIn } from './guests.ts';
import { handoffPlugin, type HandoffPluginConfig } from './handoff.ts';
import { newUserId } from './ids.ts';
import { ADMIN_HEADER, sameSecret } from './secrets.ts';
import { wwwTwin } from '@liveworkspace/sites/www';

export const AUTH_BASE_PATH = '/api/auth';
export const SEND_CODE_PATH = '/email-otp/send-verification-otp';
export const SIGN_IN_CODE_PATH = '/sign-in/email-otp';
// The email-otp plugin's other routes. Signing in is the only code flow here (no passwords, no email change), and
// `check-verification-otp` checks a sign-in code without spending it, counting attempts in a read and a separate write,
// so guesses sent at once all count as one. Off, with the plugin's code flows nothing here uses.
export const UNUSED_CODE_PATHS = [
  '/email-otp/check-verification-otp',
  '/email-otp/verify-email',
  '/email-otp/request-password-reset',
  '/forget-password/email-otp',
  '/email-otp/reset-password',
  '/email-otp/request-email-change',
  '/email-otp/change-email',
] as const;

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
  // Production's cookie domain (cookie-scope.ts), so one session is valid on www. and the bare domain alike; left out
  // for host-only cookies (staging, local development, the schema).
  cookieDomain?: string;
  // The hand-off that brings a session made on an app's address here (handoff.ts).
  handoff?: HandoffPluginConfig;
  // `request` is the send's own, when there is one: whose address it came through picks the email's brand.
  sendCode: (email: string, code: string, request?: Request) => Promise<void>;
  // The teams an account is in, for its access tokens (teams.ts teamsClaim). Left out where there is
  // no database to ask, as when generating the schema.
  teamsFor?: (userId: string) => Promise<{ id: string; name: string; role: string }[]>;
  // The account's presence colour and picture switch (profiles.ts readProfileLook), for the ID token's
  // `presence_color` and `picture_hidden` claims. Left out where there is no database to ask, as when
  // generating the schema.
  lookFor?: (userId: string) => Promise<{ color: string | null; showPicture: boolean }>;
  // A Google sign-in's `picture` claim onto the account (profiles.ts storeAccountPicture), at every Google
  // sign-in so a new picture shows after the next one. Left out where there is no database.
  storePicture?: (userId: string, picture: unknown) => Promise<void>;
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
    // their tokens from /oauth2/token instead, so this one stays off. So do the code routes
    // other than sending one and signing in with it (UNUSED_CODE_PATHS).
    disabledPaths: ['/token', ...UNUSED_CODE_PATHS],
    // The sign-in pages on each app's own address (handoff.ts) post here through the app's router. This Worker's own
    // origin is trusted already; its twin on the other host is too, while the move to www. lasts (pages cached on the
    // bare domain before it still post from there).
    trustedOrigins: [...(config.appOrigins ?? []), ...twinOrigin(config.baseUrl)],
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
          // Google's first and last name fill the account's, and its picture is the account's
          // profile picture (liveworkspace/docs/accounts.md "Profile pictures") when it is one the
          // apps draw. A later sign-in refreshes the picture (the account hook below), not the names.
          mapProfileToUser: (profile) => ({
            givenName: profile.given_name,
            familyName: profile.family_name,
            image: profilePictureOf(profile.picture) ?? undefined,
          }),
        },
      },
    }),
    // Signing in with Google on an address that already has an account (made with an email code) joins that account
    // rather than failing, when Google says it verified the address (`email_verified`). Google is not a trusted
    // provider: trusted, better-auth would join on an address Google had not verified too.
    account: { accountLinking: { enabled: true } },
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
      // Every Google sign-in, and Google connected to an account made with a code, writes the account row
      // with the ID token Google has just handed over: its `picture` claim becomes the account's picture.
      account: {
        create: { after: async (account) => storeGooglePicture(config, account) },
        update: { after: async (account) => storeGooglePicture(config, account) },
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
      ...(config.cookieDomain && {
        crossSubDomainCookies: { enabled: true, domain: config.cookieDomain },
      }),
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
        async sendVerificationOTP({ email, otp, type }, ctx) {
          // Sign-in is the only flow here: there are no passwords to reset, and signing in
          // with a code is what verifies the address.
          if (type !== 'sign-in') return;
          await config.sendCode(email, otp, ctx?.request);
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
        // The picture rides the same way, as the standard `picture` claim (the person's own, for their own
        // chrome), with `picture_hidden` when they turned Show My Google Picture off; the same one read.
        customIdTokenClaims: async ({ user, scopes }) =>
          idTokenClaims(
            user,
            scopes,
            scopes.includes('profile') && config.lookFor
              ? await config.lookFor(user.id).catch(() => null)
              : null,
          ),
      }),
    ],
  } satisfies BetterAuthOptions;
}

// The other host's origin of this Worker's own, when it has one (@liveworkspace/sites/www).
function twinOrigin(baseUrl: string): string[] {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }
  const twin = wwwTwin(origin);
  return twin ? [twin] : [];
}

type AccountRow = { userId?: unknown; providerId?: unknown; idToken?: unknown };

// A Google account row just written: its ID token's `picture` claim onto the account. Google's token came
// straight from its token endpoint over TLS (Better Auth reads its claims the same way), so the claims are read
// without checking the signature. A failure is logged and never fails the sign-in.
async function storeGooglePicture(config: AuthConfig, account: AccountRow): Promise<void> {
  if (!config.storePicture || account.providerId !== 'google') return;
  if (typeof account.userId !== 'string' || typeof account.idToken !== 'string') return;
  await config
    .storePicture(account.userId, idTokenPicture(account.idToken))
    .catch((error: unknown) => console.error('[profile-picture] store failed', error));
}

/** The `picture` claim of an ID token (a JWT), or null when it has none or isn't one. */
export function idTokenPicture(idToken: string): string | null {
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { picture?: unknown };
    return profilePictureOf(claims.picture);
  } catch {
    return null;
  }
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

type ClaimUser = NamedUser & { email: string; emailVerified: boolean; image?: string | null };

// `look`: the profile's presence colour and picture switch (profiles.ts readProfileLook), claims of the profile
// scope beside the names and the account's picture.
export function idTokenClaims(
  user: ClaimUser,
  scopes: string[],
  look: { color: string | null; showPicture: boolean } | null = null,
): Record<string, unknown> {
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  const picture = profilePictureOf(user.image);
  return {
    ...(scopes.includes('profile') && {
      name: text(user.name),
      given_name: text(user.givenName),
      family_name: text(user.familyName),
      ...(look?.color && { presence_color: look.color }),
      ...(picture && { picture }),
      ...(picture && look?.showPicture === false && { picture_hidden: true }),
    }),
    ...(scopes.includes('email') && { email: user.email, email_verified: user.emailVerified }),
  };
}
