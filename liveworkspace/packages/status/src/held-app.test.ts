import { APP_SITES, HELD_APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { appGroup, hasMcp, mcpOrigin, statusGroups } from './services';

// The MCP server is optional per app (liveworkspace/docs/specs/009-status/status.md "Where the checks go"), and a held
// app is not on the page until it launches.
const huddle = HELD_APP_SITES.find((site) => site.id === 'livehuddle.app')!;

describe('the MCP check, optional per app', () => {
  it('stays for every listed app', () => {
    for (const site of APP_SITES) {
      expect(hasMcp(site)).toBe(true);
      const ids = appGroup(site, 'production').services.map((s) => s.id);
      expect(ids).toContain(`${site.name}:mcp`);
    }
  });

  it("checks the held app's MCP server too", () => {
    expect(hasMcp(huddle)).toBe(true);
    expect(mcpOrigin(huddle, 'production')).toBe('https://mcp.livehuddle.app');
    expect(mcpOrigin(huddle, 'development')).toBe('http://localhost:9088');
    expect(mcpOrigin(huddle, 'staging')).toBeNull();
    expect(appGroup(huddle, 'production').services.map((s) => s.id)).toEqual([
      'livehuddle:api',
      'livehuddle:realtime',
      'livehuddle:editor',
      'livehuddle:marketing',
      'livehuddle:help',
      'livehuddle:mcp',
      'livehuddle:router',
    ]);
    expect(appGroup(huddle, 'development').services[0]!.check).toMatchObject({
      probe: { url: 'http://localhost:3500/api/capabilities' },
    });
  });

  it('is left out for an app that ships no MCP server, in every environment', () => {
    // No registered app ships without one today, so a made-up site stands in for one.
    const bare = { ...huddle, id: 'livenone.app' } as unknown as typeof huddle;
    expect(hasMcp(bare)).toBe(false);
    for (const env of ['production', 'staging', 'development'] as const) {
      expect(mcpOrigin(bare, env)).toBeNull();
    }
  });

  it('is never asked of the platform itself', () => {
    expect(hasMcp({ ...huddle, id: 'liveworkspace.app' })).toBe(false);
  });
});

describe('a held app', () => {
  it('is not on the page', () => {
    for (const env of ['production', 'staging', 'development'] as const) {
      expect(statusGroups(env).map((g) => g.id)).toEqual([
        'liveworkspace',
        'livediagram',
        'liveplanner',
        'livedocuments',
        'livedesign',
      ]);
    }
  });
});
