// liveknowledge/server.json, the MCP Registry descriptor (docs/specs/015-api/mcp-server.md §4.16), is valid against the
// registry's schema and names this product, its namespace, version, icon and hosted endpoint.
import { describe, expect, it } from 'vitest';
import { serverJsonProblems } from '@liveworkspace/mcp-kit/server-json';
import serverJson from '../../../server.json';
import { LISTING } from './listing';

describe('liveknowledge/server.json', () => {
  it('is a valid registry descriptor for liveknowledge', () => {
    expect(serverJsonProblems(serverJson, LISTING)).toEqual([]);
  });

  it('lists liveknowledge under the monorepo organisation, at its own MCP Worker', () => {
    expect(serverJson).toMatchObject({
      name: 'io.github.livediagram-app/liveknowledge',
      title: 'liveknowledge',
      remotes: [{ type: 'streamable-http', url: 'https://mcp.liveknowledge.app/mcp' }],
    });
  });
});
