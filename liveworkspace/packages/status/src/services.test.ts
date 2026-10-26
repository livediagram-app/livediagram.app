import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import {
  allServices,
  appOrigin,
  environmentOf,
  mcpOrigin,
  probedServices,
  resolveProbeUrl,
  statusGroups,
} from './services';

// liveworkspace/docs/specs/010-site/site.md "Status": the one list of services the page and the status Worker both check.

describe('the status page’s services', () => {
  const groups = statusGroups('production');

  it('lists liveworkspace’s shared services first, then every app in the shared order', () => {
    expect(groups.map((g) => g.id)).toEqual([
      'liveworkspace',
      ...APP_SITES.map((s) => s.id.replace(/\.app$/, '')),
    ]);
    expect(groups[0]!.services.map((s) => s.name)).toEqual([
      'Website',
      'Accounts & sign-in',
      'Explorer index',
      'Community',
      'Telemetry',
      'Media & previews',
    ]);
  });

  it('gives every app its API, realtime rooms, editor, marketing site, help centre, MCP server and router', () => {
    for (const group of groups.slice(1)) {
      const names = group.services.map((s) => s.name);
      for (const name of [
        'API',
        'Realtime rooms',
        'Editor',
        'Marketing site',
        'Help centre',
        'MCP server',
        'Router',
      ])
        expect(names, group.id).toContain(name);
    }
  });

  it('keeps every id unique, and every derived service standing on a real check', () => {
    const services = allServices(groups);
    const ids = new Set(services.map((s) => s.id));
    expect(ids.size).toBe(services.length);
    for (const s of services)
      if (s.check.mode === 'derived')
        for (const from of s.check.from) expect(ids.has(from), s.id).toBe(true);
  });

  it('reads only what it may: this origin, or the apps’ CORS routes; any other page is only reached', () => {
    for (const s of allServices(groups)) {
      if (s.check.mode !== 'probe') continue;
      const { probe } = s.check;
      if (probe.kind === 'reach') expect(probe.method, s.id).toBe('HEAD');
      else
        expect(
          probe.url.startsWith('/') ||
            /\/api\/capabilities$|^https:\/\/(mcp\.[a-z]+\.app|livediagram-mcp\.liveworkspace-easing509\.workers\.dev)\/health$/.test(
              probe.url,
            ),
          s.id,
        ).toBe(true);
    }
  });

  it('checks each app where the page is: production, staging or a dev server', () => {
    const site = APP_SITES[0]!;
    expect(environmentOf('liveworkspace.app')).toBe('production');
    expect(environmentOf('staging.liveworkspace.app')).toBe('staging');
    expect(environmentOf('localhost:3000')).toBe('development');
    expect(appOrigin(site, 'production')).toBe(
      'https://livediagram-router.liveworkspace-easing509.workers.dev',
    );
    expect(appOrigin(site, 'staging')).toBe(
      'https://livediagram-router-staging.liveworkspace-easing509.workers.dev',
    );
    expect(appOrigin(site, 'development')).toBe('http://localhost:3100');
    expect(mcpOrigin(site, 'production')).toBe(
      'https://livediagram-mcp.liveworkspace-easing509.workers.dev',
    );
    expect(mcpOrigin(site, 'staging')).toBeNull();
    const staging = statusGroups('staging')[1]!.services.find((s) => s.name === 'MCP server');
    expect(staging?.check.mode).toBe('skipped');
  });

  it('resolves liveworkspace’s own paths on its origin, and leaves every app’s address as written', () => {
    const [site, , , , , , api] = probedServices(groups);
    expect(site!.id).toBe('liveworkspace:site');
    expect(resolveProbeUrl(site!.check.probe, 'https://lw.example/')).toBe(
      'https://lw.example/robots.txt',
    );
    expect(api!.id).toBe('livediagram:api');
    expect(resolveProbeUrl(api!.check.probe, 'https://lw.example')).toBe(
      'https://livediagram-router.liveworkspace-easing509.workers.dev/api/capabilities',
    );
  });

  it('keeps one round small: 27 requests, under a Worker’s 50 subrequests with room to spare', () => {
    expect(probedServices(groups)).toHaveLength(27);
    expect(probedServices(groups).length).toBeLessThan(40);
    expect(allServices(groups).filter((s) => s.check.mode !== 'skipped')).toHaveLength(35);
  });
});
