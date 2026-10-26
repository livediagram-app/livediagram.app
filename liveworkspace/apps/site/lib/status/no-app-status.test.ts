import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';

// liveworkspace/docs/specs/010-site/site.md "Status": one status page, here, and no app with a status page of its own. The list of
// services it checks is @liveworkspace/status's, tested there.

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
