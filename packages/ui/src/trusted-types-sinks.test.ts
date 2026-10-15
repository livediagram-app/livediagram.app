import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// docs/specs/016-platform/trusted-types.md: every sink our code feeds goes through a policy, every page boots the
// default policy first, and every app sends the header.

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(`${repo}${path}`, 'utf8');
const APPS = ['live', 'marketing', 'help', 'community', 'telemetry'] as const;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (
      ['node_modules', 'out', 'dist', 'e2e', 'test-results', 'scripts'].includes(name) ||
      name.startsWith('.')
    )
      continue;
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}
const files = ['apps', 'packages']
  .flatMap((d) => sources(`${repo}${d}`))
  .map((f) => f.slice(repo.length));

// Where the expression handed to `__html` starts, for every dangerouslySetInnerHTML in a file.
const htmlExpressions = (source: string) =>
  [...source.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*/g)].map((m) =>
    source.slice(m.index! + m[0].length, m.index! + m[0].length + 40),
  );

describe('Trusted Types sinks', () => {
  it('hand dangerouslySetInnerHTML only what trustedHtml made', () => {
    const raw = files.flatMap((f) =>
      htmlExpressions(read(f))
        .filter((expr) => !expr.startsWith('trustedHtml('))
        .map((expr) => `${f}: ${expr.split('\n')[0]}`),
    );
    expect(raw).toEqual([]);
  });

  it('parse files only through parseInert', () => {
    const direct = files.filter(
      (f) =>
        /\bnew DOMParser\(\)/.test(read(f)) &&
        !f.endsWith('packages/ui/src/trusted-types.ts') &&
        !f.endsWith('apps/live/lib/drawio/test-support.ts'),
    );
    expect(direct).toEqual([]);
  });
});

describe.each(APPS)('apps/%s', (app) => {
  it('boots the default policy before any other script', () => {
    const layout = read(`apps/${app}/app/layout.tsx`);
    // The JSX <head> element (a line of its own), then the first <script> inside it.
    const head = layout.slice(layout.search(/^\s*<head>$/m));
    const first = head.indexOf('<script');
    expect(head.slice(first, head.indexOf('/>', first))).toContain(
      'trustedHtml(TRUSTED_TYPES_BOOT)',
    );
    // Its own build's scripts, under the prefix next.config.ts serves them from (basePath or assetPrefix).
    const config = read(`apps/${app}/next.config.ts`);
    const prefix = /(?:basePath|assetPrefix): '([^']+)'/.exec(config)?.[1] ?? '';
    expect(layout).toContain(`const TRUSTED_TYPES_BOOT = trustedTypesBootScript(\n  '${prefix}',`);
  });

  it('sends the Trusted Types header on every page', () => {
    if (app === 'live') {
      const worker = read('apps/live/src/worker.ts');
      expect(worker).toMatch(/'Content-Security-Policy':\s*TRUSTED_TYPES_CSP/);
    } else {
      const headers = read(`apps/${app}/public/_headers`);
      expect(headers).toContain(`/*\n`);
      expect(headers).toContain(`  Content-Security-Policy: ${TRUSTED_TYPES_CSP}\n`);
    }
  });
});
