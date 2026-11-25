// liveworkspace/server.json, the one MCP's MCP Registry descriptor (liveworkspace/docs/specs/021-mcp/mcp.md), is valid
// against the registry's schema and matches the server's own listing. Publishing it is by hand (mcp-registry.yml).
import { describe, expect, it } from 'vitest';
import { serverJsonProblems } from '@liveworkspace/mcp-kit/server-json';
import serverJson from '../../../server.json';
import { LISTING } from './listing';

describe('liveworkspace/server.json', () => {
  it('is a valid registry descriptor that matches the listing', () => {
    expect(serverJsonProblems(serverJson, LISTING)).toEqual([]);
  });

  it('names the one MCP at its hosted endpoint', () => {
    expect(serverJson).toMatchObject({
      name: 'io.github.livediagram-app/liveworkspace',
      remotes: [{ type: 'streamable-http', url: 'https://mcp.liveworkspace.app/mcp' }],
    });
  });
});
