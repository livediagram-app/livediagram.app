import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { appGroup, hasMcp, mcpOrigin, statusGroups } from './services';

// The MCP server is optional per app (liveworkspace/docs/specs/009-status/status.md "Where the checks go"), and
// livehuddle, launched, is on the page as every app is, with no MCP server (Work Tracker #562).
const huddle = APP_SITES.find((site) => site.id === 'livehuddle.app')!;

describe('the MCP check, optional per app', () => {
  it('stays for every listed app that ships one', () => {
    for (const site of APP_SITES.filter((s) => s.id !== 'livehuddle.app')) {
      expect(hasMcp(site)).toBe(true);
      const ids = appGroup(site, 'production').services.map((s) => s.id);
      expect(ids).toContain(`${site.name}:mcp`);
    }
  });

  it('is left out for livehuddle, which ships no MCP server, in every environment', () => {
    expect(hasMcp(huddle)).toBe(false);
    for (const env of ['production', 'staging', 'development'] as const) {
      expect(mcpOrigin(huddle, env)).toBeNull();
    }
    expect(appGroup(huddle, 'production').services.map((s) => s.id)).toEqual([
      'livehuddle:api',
      'livehuddle:realtime',
      'livehuddle:editor',
      'livehuddle:marketing',
      'livehuddle:help',
      'livehuddle:router',
    ]);
    expect(appGroup(huddle, 'development').services[0]!.check).toMatchObject({
      probe: { url: 'http://localhost:3500/api/capabilities' },
    });
  });

  it('is never asked of the platform itself', () => {
    expect(hasMcp({ ...huddle, id: 'liveworkspace.app' })).toBe(false);
  });
});

describe('a launched app', () => {
  it('is on the page, last', () => {
    for (const env of ['production', 'staging', 'development'] as const) {
      expect(statusGroups(env).map((g) => g.id)).toEqual([
        'liveworkspace',
        'livediagram',
        'liveplanner',
        'livedocuments',
        'livedesign',
        'livehuddle',
      ]);
    }
  });
});
