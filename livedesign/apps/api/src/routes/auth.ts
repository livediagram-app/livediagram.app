// /api/auth/*: signing in through the liveworkspace accounts Worker
// (docs/specs/014-identity/auth-and-guest-access.md "Signing in"). The routes, their checks and their cookies live
// once in @liveworkspace/auth-client/app-auth; this binds them to livedesign's cookie names, return-path rule and PKCE
// cookie codec. Handled before the caller's identity is resolved (src/index.ts): none of these carry a Bearer, so
// they would otherwise all share one 'anonymous' write-rate bucket.

import { SIGNED_IN_HINT_COOKIE } from '@livedesign/api-schema';
import {
  createAppAuth,
  decodeUtf8PkceCookie,
  encodeUtf8PkceCookie,
  type AppAuthUser,
} from '@liveworkspace/auth-client/app-auth';
import { safeReturnPath as sharedSafeReturnPath } from '@liveworkspace/auth-client/return-path';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { reportSignIn } from '../auth/session-telemetry';
import { json, notFound, rateLimited } from '../responses';
import type { Env } from '../types';

export { configured, readCookie } from '@liveworkspace/auth-client/app-auth';

const DEFAULT_RETURN = '/explorer/home';

// What the page renders for the signed-in account (AuthControls, Settings, the editor's name).
export type AuthUser = {
  id: string;
  email: string | null;
  // The header's name first, as liveworkspace.app's (accountNameOf).
  givenName: string | null;
  name: string | null;
  // The profile's presence colour (the ID token's `presence_color`), for the avatar; null for Automatic.
  color: string | null;
  // The account's Google picture (the ID token's `picture`, liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"), for
  // the person's own avatar; null without one.
  picture: string | null;
  // Show My Google Picture is off (`picture_hidden`): the person's own chrome still shows it, but presence and
  // anything others see leave it out.
  pictureHidden: boolean;
};

// Only a path on this site (`@liveworkspace/auth-client/return-path`), else the Explorer.
export const safeReturnPath = (value: string | null): string =>
  sharedSafeReturnPath(value, DEFAULT_RETURN);

const auth = createAppAuth<Env, AuthUser & AppAuthUser>({
  hintCookie: SIGNED_IN_HINT_COOKIE,
  pkceCookie: 'ldes_pkce',
  refreshCookie: 'ldes_refresh',
  safeReturnPath,
  encodePkce: encodeUtf8PkceCookie,
  decodePkce: decodeUtf8PkceCookie,
  // A Location past ASCII is percent-encoded as UTF-8, or building the header throws.
  asciiLocation: true,
  // The token answer says how old the ID token is, so the page can compare it with a Show My Google Picture save
  // (docs/specs/014-identity/profile-and-email-notifications.md "Avatars").
  tokenAge: true,
  json: (body, init) => json(body, init),
  notFound: () => notFound(),
  rateLimited: () => rateLimited(),
  clientRateKey,
  reportSignIn: (env, userId) => reportSignIn(env, userId),
});

// The refresh cookie cleared, the hint at `0` and the name cookies dropped, together.
export const signedOutCookies = auth.signedOutCookies;

export const handleAuth = auth.handleAuth;
