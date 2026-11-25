// The OAuth client liveknowledge ships itself (docs/specs/015-api/blueprints/cli.md "The CLI's OAuth client", CLI35,
// CLI36): its CLI client's id and name, which the one MCP (liveworkspace/docs/specs/021-mcp/mcp.md) lists as a
// built-in client. The callbacks, the device grant and its user codes are every product's, from
// @liveworkspace/api-kit/oauth. Used by the CLI.

export const CLI_CLIENT_ID = 'liveknowledge-cli';
export const CLI_CLIENT_NAME = 'liveknowledge CLI';

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
