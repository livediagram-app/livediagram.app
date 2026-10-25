// Where the consent page sends its session lookup and minted token
// (docs/specs/015-api/mcp-server.md §3). A blank build value must fall back to
// the hosted MCP, never to '' (a same-origin path on the editor's own host).
import { describe, expect, it } from 'vitest';
import { createMcpOriginResolver, mcpEndpoint } from './mcp-origin';

const HOSTED = 'https://mcp.hosted.example';
const resolveMcpOrigin = createMcpOriginResolver(HOSTED);

describe('createMcpOriginResolver', () => {
  it('falls back to the hosted MCP when unset', () => {
    expect(resolveMcpOrigin(undefined)).toBe(HOSTED);
  });
  it('falls back when the build passes an empty string (the production deploy does)', () => {
    expect(resolveMcpOrigin('')).toBe(HOSTED);
    expect(resolveMcpOrigin('   ')).toBe(HOSTED);
  });
  it('uses an explicit origin, without a trailing slash', () => {
    expect(resolveMcpOrigin('https://mcp-staging.example.com')).toBe(
      'https://mcp-staging.example.com',
    );
    expect(resolveMcpOrigin('https://mcp.example.com/')).toBe('https://mcp.example.com');
    expect(resolveMcpOrigin('https://mcp.example.com///')).toBe('https://mcp.example.com');
    expect(resolveMcpOrigin('///')).toBe(HOSTED);
    // A long run of slashes strips in one pass (a `/\/+$/` regex backtracked on it).
    expect(resolveMcpOrigin(`x${'/'.repeat(200_000)}a${'/'.repeat(200_000)}`)).toBe(
      `x${'/'.repeat(200_000)}a`,
    );
  });

  it('puts the endpoint path on the origin', () => {
    expect(mcpEndpoint(resolveMcpOrigin('https://mcp.example.com/'))).toBe(
      'https://mcp.example.com/mcp',
    );
  });
});
