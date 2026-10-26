// The shape of an API token: a liveworkspace account token, `lwt_` and its random part
// (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"). Shared by every product's api Worker, which routes a
// `Bearer lwt_…` to the token path, and its CLI, which refuses a malformed `<PRODUCT>_TOKEN` before
// sending it (each product's docs/specs/015-api/blueprints/cli.md CLI63).
//
// Tokens carried over from the old livediagram.app keep their `lvd_` prefix (docs/migration.md step 1): the
// accounts Worker holds them as it holds `lwt_` ones, so every shape check takes either. Nothing mints `lvd_`.

export const API_TOKEN_PREFIX = 'lwt_';
export const LEGACY_API_TOKEN_PREFIX = 'lvd_';

/** Whether a bearer claims to be an API token (either prefix), however short: the token path refuses it then. */
export function hasApiTokenPrefix(value: string): boolean {
  return value.startsWith(API_TOKEN_PREFIX) || value.startsWith(LEGACY_API_TOKEN_PREFIX);
}

export function isApiTokenFormat(value: string): boolean {
  // Both prefixes are four characters.
  return hasApiTokenPrefix(value) && value.length > API_TOKEN_PREFIX.length + 20;
}
