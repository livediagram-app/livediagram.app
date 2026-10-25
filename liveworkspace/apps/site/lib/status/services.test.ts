import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { allServices, appOrigin, environmentOf, mcpOrigin, statusGroups } from './services';

// liveworkspace/docs/site.md "Status": the one status page, its groups, and no app with a status page of its own.

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
            /\/api\/capabilities$|^https:\/\/mcp\.[a-z]+\.app\/health$/.test(probe.url),
          s.id,
        ).toBe(true);
    }
  });

  it('checks each app where the page is: production, staging or a dev server', () => {
    const site = APP_SITES[0]!;
    expect(environmentOf('liveworkspace.app')).toBe('production');
    expect(environmentOf('staging.liveworkspace.app')).toBe('staging');
    expect(environmentOf('localhost:3000')).toBe('development');
    expect(appOrigin(site, 'production')).toBe('https://www.livediagram.app');
    expect(appOrigin(site, 'staging')).toBe('https://staging.livediagram.app');
    expect(appOrigin(site, 'development')).toBe('http://localhost:3100');
    expect(mcpOrigin(site, 'production')).toBe('https://mcp.livediagram.app');
    expect(mcpOrigin(site, 'staging')).toBeNull();
    const staging = statusGroups('staging')[1]!.services.find((s) => s.name === 'MCP server');
    expect(staging?.check.mode).toBe('skipped');
  });
});

// Every app used to keep its own /status page; now only liveworkspace's exists, and every link goes there.
describe('no app keeps a status page of its own', () => {
  const repo = join(import.meta.dirname, '../../../../..');
  const apps = APP_SITES.map((s) => s.id.replace(/\.app$/, ''));

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      if (
        ['node_modules', 'out', '.next', '.next-dev', '.turbo'].includes(name) ||
        name.startsWith('.')
      )
        return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.(tsx?|mdx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }

  it('has no /status route in any app’s marketing site', () => {
    for (const app of apps) {
      const dir = join(repo, app, 'apps/marketing/app');
      expect(readdirSync(dir), app).not.toContain('status');
    }
  });

  it('links to no /status on an app’s own address, from its sites or the shared footer', () => {
    const roots = [
      join(repo, 'packages/ui/src'),
      ...apps.flatMap((app) =>
        ['apps/marketing', 'apps/help', 'packages/ui/src']
          .map((p) => join(repo, app, p))
          .filter((p) => {
            try {
              return statSync(p).isDirectory();
            } catch {
              return false;
            }
          }),
      ),
    ];
    const OWN_STATUS = /href=["'{`]+\/status\b|href:\s*['"`]\/status\b|\]\(\/status\b/;
    const offenders = roots
      .flatMap(sources)
      .filter((path) => OWN_STATUS.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
