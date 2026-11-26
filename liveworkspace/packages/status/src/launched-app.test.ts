import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { appGroup, mcpOrigin, statusGroups } from './services';

// There is one MCP server, checked once under liveworkspace and never under an app
// (liveworkspace/docs/specs/009-status/status.md "Where the checks go"; Work Tracker 1483).
const huddle = APP_SITES.find((site) => site.id === 'livehuddle.app')!;

describe('the one MCP check', () => {
  it('is no app group’s row, in any environment', () => {
    for (const env of ['production', 'staging', 'development'] as const) {
      for (const site of APP_SITES) {
        const ids = appGroup(site, env).services.map((s) => s.id);
        expect(
          ids.some((id) => id.endsWith(':mcp')),
          site.id,
        ).toBe(false);
      }
    }
  });

  it('is one row under liveworkspace, on the one MCP’s address', () => {
    expect(mcpOrigin('production')).toBe('https://mcp.liveworkspace.app');
    expect(mcpOrigin('development')).toBe('http://localhost:3013');
    expect(mcpOrigin('staging')).toBeNull();
    for (const env of ['production', 'staging', 'development'] as const) {
      const mcp = statusGroups(env)[0]!.services.filter((s) => s.id.endsWith(':mcp'));
      expect(mcp.map((s) => s.id)).toEqual(['liveworkspace:mcp']);
    }
  });

  it('leaves livehuddle with its five services', () => {
    expect(appGroup(huddle, 'production').services.map((s) => s.id)).toEqual([
      'livehuddle:api',
      'livehuddle:realtime',
      'livehuddle:editor',
      'livehuddle:marketing',
      'livehuddle:router',
    ]);
    expect(appGroup(huddle, 'development').services[0]!.check).toMatchObject({
      probe: { url: 'http://localhost:3500/api/capabilities' },
    });
  });
});

describe('a launched app', () => {
  it('is on the page', () => {
    for (const env of ['production', 'staging', 'development'] as const) {
      expect(statusGroups(env).map((g) => g.id)).toEqual([
        'liveworkspace',
        'livediagram',
        'liveplanner',
        'livedocuments',
        'livedesign',
        'livehuddle',
        'liveknowledge',
      ]);
    }
  });
});
