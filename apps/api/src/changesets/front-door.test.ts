import { describe, expect, it } from 'vitest';
import { frontDoorOf } from './front-door';

const req = (client?: string) =>
  new Request('https://api.test/', client ? { headers: { 'X-Livediagram-Client': client } } : {});

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
});
