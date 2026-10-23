// The shape of an API token (docs/specs/015-api/public-api-and-tokens.md): a liveworkspace account token,
// `lwt_` and its random part (liveworkspace/docs/accounts.md "API tokens"). Shared by the api worker,
// which routes a `Bearer lwt_…` to the token path, and the CLI, which refuses a malformed
// LIVEDOCUMENTS_TOKEN before sending it (docs/specs/015-api/blueprints/cli.md CLI63).

export const API_TOKEN_PREFIX = 'lwt_';

export function isApiTokenFormat(value: string): boolean {
  return value.startsWith(API_TOKEN_PREFIX) && value.length > API_TOKEN_PREFIX.length + 20;
}
