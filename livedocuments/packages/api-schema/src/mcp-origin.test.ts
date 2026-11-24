// The MCP address the Build with AI page shows: liveworkspace's one MCP. A blank build value must fall back to
// the hosted one, never to '' (a same-origin path on the site's own host).
import { describe, expect, it } from 'vitest';
import { DEFAULT_MCP_ORIGIN, mcpEndpoint, resolveMcpOrigin } from './mcp-origin';

// The resolver's rules are tested in @liveworkspace/api-schema; here, that it is bound to livedocuments's MCP.
describe('resolveMcpOrigin', () => {
  it('falls back to the hosted MCP when unset or blank', () => {
    expect(resolveMcpOrigin(undefined)).toBe(DEFAULT_MCP_ORIGIN);
    expect(resolveMcpOrigin('')).toBe(DEFAULT_MCP_ORIGIN);
    expect(DEFAULT_MCP_ORIGIN).toBe('https://mcp.liveworkspace.app');
  });

  it('uses an explicit origin, and puts the endpoint path on it', () => {
    expect(mcpEndpoint(resolveMcpOrigin('https://mcp.example.com/'))).toBe(
      'https://mcp.example.com/mcp',
    );
  });
});
