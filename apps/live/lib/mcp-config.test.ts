// Where the consent page sends its session lookup and minted token
// (docs/specs/015-api/mcp-server.md §3). A blank build value must fall back to
// the hosted MCP, never to '' (a same-origin path on the editor's own host).
import { describe, expect, it } from 'vitest';
import { DEFAULT_MCP_ORIGIN, resolveMcpOrigin } from './mcp-config';

describe('resolveMcpOrigin', () => {
  it('falls back to the hosted MCP when unset', () => {
    expect(resolveMcpOrigin(undefined)).toBe(DEFAULT_MCP_ORIGIN);
  });
  it('falls back when the build passes an empty string (the production deploy does)', () => {
    expect(resolveMcpOrigin('')).toBe(DEFAULT_MCP_ORIGIN);
    expect(resolveMcpOrigin('   ')).toBe(DEFAULT_MCP_ORIGIN);
  });
  it('uses an explicit origin, without a trailing slash', () => {
    expect(resolveMcpOrigin('https://mcp-staging.livediagram.app')).toBe(
      'https://mcp-staging.livediagram.app',
    );
    expect(resolveMcpOrigin('https://mcp.example.com/')).toBe('https://mcp.example.com');
  });
});
