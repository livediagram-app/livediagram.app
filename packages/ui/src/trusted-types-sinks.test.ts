import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// docs/specs/016-platform/trusted-types.md: every sink our code feeds goes through a policy, every page boots the
// default policy first, and every app sends the header.

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(`${repo}${path}`, 'utf8');
const APPS = ['live', 'marketing', 'help', 'telemetry'] as const;

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
    source.slice(m.index + m[0].length, m.index + m[0].length + 40),
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

  // A DOM sink written by hand meets the same default policy, which refuses it and throws: the canvas's Marker
  // finish set `innerHTML` raw and every Marker tab failed to render in production.
  it('write markup straight into the DOM only through trustedHtml', () => {
    const raw = files.flatMap((f) =>
      [...read(f).matchAll(/\.(?:innerHTML|outerHTML)\s*=(?!=)\s*|\binsertAdjacentHTML\(/g)]
        .filter((m) => {
          const rest = read(f).slice(m.index + m[0].length);
          return m[0].startsWith('insertAdjacentHTML')
            ? !/^[^,]*,\s*trustedHtml\(/.test(rest)
            : !rest.startsWith('trustedHtml(');
        })
        .map((m) => `${f}: ${m[0]}`),
    );
    expect(raw).toEqual([]);
  });

  // A server component's `trustedHtml` runs in the prerender, where there is no Trusted Types, so the RSC payload
  // carries a plain string; a client navigation then writes it through innerHTML and the default policy refuses
  // it, crashing the page to blank (the help centre's breadcrumbs did this to every page). So outside the editor
  // (a client app end to end) a sink lives in a root layout (never re-rendered on navigation), a 'use client'
  // module, or an app module only client modules import.
  it('mint TrustedHTML in the browser, never in a server component', () => {
    const isClient = (f: string) => /^'use client';/.test(read(f));
    const isLayout = (f: string) => /^apps\/[^/]+\/app\/layout\.tsx$/.test(f);
    const sinks = files.filter(
      (f) => !f.startsWith('apps/live/') && htmlExpressions(read(f)).length > 0,
    );
    // Who imports a module, by its path without extension (relative or `@/` specifiers).
    const importers = (target: string) =>
      files.filter((f) => {
        if (f.startsWith('apps/live/')) return false;
        const app = /^(apps|packages)\/[^/]+\//.exec(f)![0];
        const stem = target.replace(/\.tsx?$/, '');
        // Type-only imports carry no code onto the page.
        return [...read(f).matchAll(/^import (?!type )[^;]*?from '([^']+)'/gms)].some(
          ([, spec = '']) => {
            const resolved = spec.startsWith('@/')
              ? `${app}${spec.slice(2)}`
              : spec.startsWith('.')
                ? new URL(spec, `file:///${f}`).pathname.slice(1)
                : null;
            return resolved === stem || resolved === stem.replace(/\/index$/, '');
          },
        );
      });
    const clientOnly = (f: string, seen = new Set<string>()): boolean => {
      if (isClient(f)) return true;
      // A shared package's component reaches whatever server page renders it, so it must be a client module itself.
      if (f.startsWith('packages/')) return false;
      // A route file is where a server render starts.
      if (/\/app\/(.+\/)?(page|template|layout)\.tsx$/.test(f)) return false;
      if (seen.has(f)) return true;
      seen.add(f);
      // No importer at all means no page renders it.
      return importers(f).every((i) => clientOnly(i, seen));
    };
    const serverSinks = sinks.filter((f) => !isLayout(f) && !clientOnly(f));
    expect(serverSinks).toEqual([]);
  });

  it('parse no files with DOMParser, which no policy lets through', () => {
    expect(files.filter((f) => /\bnew DOMParser\(\)/.test(read(f)))).toEqual([]);
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
