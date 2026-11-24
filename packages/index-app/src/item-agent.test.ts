import { describe, expect, it } from 'vitest';
import { ITEM_AGENT_NAME_MAX } from '@liveworkspace/index-client';
import { itemAgentOf } from './item-agent';

// liveworkspace/docs/specs/004-index/one-explorer-contracts.md "The event log" (Work Tracker 1381).
const HEADERS = { client: 'X-Liveplanner-Client' };
const request = (headers: Record<string, string> = {}) =>
  new Request('https://api.example/api/projects/p', { method: 'PUT', headers });

describe('itemAgentOf', () => {
  it("is null for a person's own request, which bears no API token", () => {
    expect(itemAgentOf(request({ 'X-Liveplanner-Client': 'mcp' }), null, HEADERS)).toBeNull();
    expect(itemAgentOf(request(), undefined, HEADERS)).toBeNull();
  });

  it('names a token by its name, with the door it came through', () => {
    const token = { name: 'Claude Code' };
    expect(itemAgentOf(request({ 'X-Liveplanner-Client': 'MCP ' }), token, HEADERS)).toEqual({
      name: 'Claude Code',
      via: 'mcp',
    });
    expect(itemAgentOf(request({ 'X-Liveplanner-Client': 'cli' }), token, HEADERS)).toEqual({
      name: 'Claude Code',
      via: 'cli',
    });
    // The editor's door with a token, or no door, is the API.
    for (const headers of [{ 'X-Liveplanner-Client': 'editor' }, {}] as Record<string, string>[])
      expect(itemAgentOf(request(headers), token, HEADERS)?.via).toBe('api');
  });

  it("prefers the client's own name where the app's MCP sends one, cleaned and cut", () => {
    const headers = { client: 'X-Liveknowledge-Client', agent: 'X-Liveknowledge-Agent' };
    const named = request({
      'X-Liveknowledge-Client': 'mcp',
      'X-Liveknowledge-Agent': ' Cursor\t ',
    });
    expect(itemAgentOf(named, { name: 'My token' }, headers)).toEqual({
      name: 'Cursor',
      via: 'mcp',
    });
    const long = request({ 'X-Liveknowledge-Agent': 'x'.repeat(500) });
    expect(itemAgentOf(long, { name: 'My token' }, headers)?.name).toHaveLength(
      ITEM_AGENT_NAME_MAX,
    );
    // A blank header falls back to the token's name.
    const blank = request({ 'X-Liveknowledge-Agent': '   ' });
    expect(itemAgentOf(blank, { name: 'My token' }, headers)?.name).toBe('My token');
  });

  it('names an agent with no name by its door', () => {
    expect(itemAgentOf(request({ 'X-Liveplanner-Client': 'mcp' }), {}, HEADERS)).toEqual({
      name: 'MCP',
      via: 'mcp',
    });
    expect(
      itemAgentOf(request({ 'X-Liveplanner-Client': 'cli' }), { name: ' ' }, HEADERS)?.name,
    ).toBe('CLI');
    expect(itemAgentOf(request(), { name: null }, HEADERS)?.name).toBe('API Token');
  });
});
