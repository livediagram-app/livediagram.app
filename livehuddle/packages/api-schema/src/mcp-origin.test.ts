// Where the consent page sends its session lookup and minted token
// (docs/specs/015-api/mcp-server.md §3). A blank build value must fall back to
// the hosted MCP, never to '' (a same-origin path on the editor's own host).
import { describe, expect, it } from 'vitest';
import { DEFAULT_MCP_ORIGIN, mcpEndpoint, resolveMcpOrigin } from './mcp-origin';

// The resolver's rules are tested in @liveworkspace/api-schema; here, that it is bound to livehuddle's MCP.
describe('resolveMcpOrigin', () => {
  it('falls back to the hosted MCP when unset or blank', () => {
    expect(resolveMcpOrigin(undefined)).toBe(DEFAULT_MCP_ORIGIN);
    expect(resolveMcpOrigin('')).toBe(DEFAULT_MCP_ORIGIN);
  });

  it('uses an explicit origin, and puts the endpoint path on it', () => {
    expect(mcpEndpoint(resolveMcpOrigin('https://mcp.example.com/'))).toBe(
      'https://mcp.example.com/mcp',
    );
  });
});
