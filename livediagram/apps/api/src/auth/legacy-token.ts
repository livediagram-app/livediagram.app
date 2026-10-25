// API tokens carried over from the old livediagram.app (docs/migration.md step 1.5): `lvd_<base64url(32 bytes)>`,
// stored by the accounts Worker beside its own `lwt_` tokens in the same hashed form, so a copied token checks out as
// any other. Nothing mints `lvd_` any more. This api picks a bearer's path by its prefix (index.ts) and keeps a
// token's bearer off the person path (auth/accounts.ts), so both read this rather than `lwt_` alone.
//
// RECONCILE: once @liveworkspace/api-kit's api-token.ts accepts `lvd_` itself (docs/migration.md "API tokens"),
// these collapse into its API_TOKEN_PREFIX checks and isApiTokenFormat.
import { API_TOKEN_PREFIX, isApiTokenFormat } from '@livediagram/api-schema';

export const LEGACY_API_TOKEN_PREFIX = 'lvd_';

/** Whether a bearer claims to be an API token, a new one or a carried-over one (well-formed or not). */
export function hasApiTokenPrefix(bearer: string): boolean {
  return bearer.startsWith(API_TOKEN_PREFIX) || bearer.startsWith(LEGACY_API_TOKEN_PREFIX);
}

/** Whether a bearer is shaped like an API token: `lwt_`, or the old `lvd_` with the same length rule. */
export function isAnyApiTokenFormat(bearer: string): boolean {
  if (bearer.startsWith(LEGACY_API_TOKEN_PREFIX))
    return bearer.length > LEGACY_API_TOKEN_PREFIX.length + 20;
  return isApiTokenFormat(bearer);
}
