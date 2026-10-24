// The OAuth clients livedocuments ships itself (docs/specs/015-api/blueprints/cli.md "OAuth server", "The CLI's OAuth
// client", CLI35, CLI36): its CLI client's id and name. The callbacks, the device grant and its user codes are every
// product's, from @liveworkspace/api-kit/oauth. Shared by the MCP worker's authorization server, the editor's
// /oauth/device page and the CLI.

export const CLI_CLIENT_ID = 'livedocuments-cli';
export const CLI_CLIENT_NAME = 'livedocuments CLI';

export {
  CLI_REDIRECT_URIS,
  DEVICE_CODE_GRANT,
  DEVICE_CODE_TTL_S,
  DEVICE_POLL_INTERVAL_S,
  DEVICE_SLOW_DOWN_S,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
  formatUserCode,
  isUserCode,
  newUserCode,
  normaliseUserCode,
} from '@liveworkspace/api-kit/oauth';
