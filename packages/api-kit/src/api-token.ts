// The shape of an API token: a liveworkspace account token, `lwt_` and its random part
// (liveworkspace/docs/accounts.md "API tokens"). Shared by every product's api Worker, which routes a
// `Bearer lwt_…` to the token path, and its CLI, which refuses a malformed `<PRODUCT>_TOKEN` before
// sending it (each product's docs/specs/015-api/blueprints/cli.md CLI63).

export const API_TOKEN_PREFIX = 'lwt_';

export function isApiTokenFormat(value: string): boolean {
  return value.startsWith(API_TOKEN_PREFIX) && value.length > API_TOKEN_PREFIX.length + 20;
}
