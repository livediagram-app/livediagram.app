// The shape of an API token (docs/specs/015-api/public-api-and-tokens.md): `lvd_` and its random part. Shared
// by the api worker, which routes a `Bearer lvd_…` to the token path, and the CLI, which refuses a malformed
// LIVEDIAGRAM_TOKEN before sending it (docs/specs/015-api/blueprints/cli.md CLI63).

export const API_TOKEN_PREFIX = 'lvd_';

export function isApiTokenFormat(value: string): boolean {
  return value.startsWith(API_TOKEN_PREFIX) && value.length > API_TOKEN_PREFIX.length + 20;
}
