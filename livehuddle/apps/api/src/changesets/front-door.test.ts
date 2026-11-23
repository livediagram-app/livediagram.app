import { describe, expect, it } from 'vitest';
import { itemAgentOf } from '@liveworkspace/index-app';
import { AGENT_HEADERS, frontDoorOf } from './front-door';

const req = (client?: string) =>
  new Request('https://api.test/', client ? { headers: { 'X-Livehuddle-Client': client } } : {});

describe('frontDoorOf', () => {
  it('names the MCP server, the CLI and the editor by their header', () => {
    expect(frontDoorOf(req('mcp'))).toBe('Mcp');
    expect(frontDoorOf(req('cli'))).toBe('Cli');
    expect(frontDoorOf(req('Editor'))).toBe('Editor');
  });

  it('reads anything else as a plain API caller', () => {
    expect(frontDoorOf(req())).toBe('Api');
    expect(frontDoorOf(req('curl'))).toBe('Api');
  });

  it("names an agent's write by its door and its client (Work Tracker 1381)", () => {
    // livehuddle has no MCP: an agent is named by its token.
    const api = new Request('https://api.test/', {
      headers: { 'X-Livehuddle-Agent': 'Claude Code' },
    });
    expect(itemAgentOf(api, { name: 'My token' }, AGENT_HEADERS)).toEqual({
      name: 'My token',
      via: 'api',
    });
    // A person's request, with no token, is no agent's.
    expect(itemAgentOf(req('mcp'), null, AGENT_HEADERS)).toBeNull();
  });
});
