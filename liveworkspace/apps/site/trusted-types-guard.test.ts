import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  INERT_PARSE_POLICY,
  MARKUP_POLICY,
  NEXTJS_POLICY,
  trustedTypesCsp,
} from '@liveworkspace/trusted-types/csp';
import { SITE_ASSET_PREFIX } from '@liveworkspace/sites/workspace-proxy';
import { describe, expect, it } from 'vitest';

// Trusted Types on liveworkspace.app (livediagram/docs/specs/016-platform/trusted-types.md), and on every app's
// address, whose router serves this site's Explorer with this site's own headers (@liveworkspace/sites/workspace-proxy).
// Every page sends the header, boots the default policy first, and feeds a sink only markup minted in the browser.
// The Explorer crashed to a blank page on every address when its layout, a server component, rendered an inline
// <script> from a plain string: the browser rendered it, and the default policy refused the innerHTML.

const site = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(path, 'utf8');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'out', 'dist', 'e2e', 'test'].includes(name) || name.startsWith('.'))
      continue;
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

// The site's own code and the shared packages its pages render (the Explorer among them).
const files = [
  ...['app', 'components', 'lib'].flatMap((d) => sources(`${site}${d}`)),
  ...readdirSync(`${root}packages`).flatMap((p) => sources(`${root}packages/${p}/src`)),
].map((f) => f.slice(root.length));
const text = (f: string) => read(`${root}${f}`);

// Never in a page: the hero manifest's builder runs only in the apps' tests, under jsdom (its own entry).
const TEST_ONLY = new Set(['packages/explorer/src/hero/manifest.tsx']);

const htmlExpressions = (source: string) =>
  [...source.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*/g)].map((m) =>
    source.slice(m.index + m[0].length, m.index + m[0].length + 40),
  );

describe('Trusted Types sinks', () => {
  it('hand dangerouslySetInnerHTML only what trustedHtml made', () => {
    const raw = files.flatMap((f) =>
      htmlExpressions(text(f))
        .filter((expr) => !expr.startsWith('trustedHtml('))
        .map((expr) => `${f}: ${expr.split('\n')[0]}`),
    );
    expect(raw).toEqual([]);
  });

  it('write markup straight into the DOM only through trustedHtml', () => {
    const raw = files
      .filter((f) => !TEST_ONLY.has(f))
      .flatMap((f) =>
        [...text(f).matchAll(/\.(?:innerHTML|outerHTML)\s*=(?!=)\s*|\binsertAdjacentHTML\(/g)]
          .filter((m) => {
            const rest = text(f).slice(m.index + m[0].length);
            return m[0].startsWith('insertAdjacentHTML')
              ? !/^[^,]*,\s*trustedHtml\(/.test(rest)
              : !rest.startsWith('trustedHtml(');
          })
          .map((m) => `${f}: ${m[0]}`),
      );
    expect(raw).toEqual([]);
  });

  // A server component's trustedHtml runs in the prerender, where there are no Trusted Types, so a client render
  // (a Suspense boundary the static export leaves to the browser, or a client navigation) meets a plain string. So a
  // sink lives in the root layout (only ever hydrated) or a 'use client' module, which mints it in the browser.
  it('mint TrustedHTML in the browser, never in a server component', () => {
    const server = files.filter(
      (f) =>
        htmlExpressions(text(f)).length > 0 &&
        f !== 'liveworkspace/apps/site/app/layout.tsx' &&
        !/^'use client';/.test(text(f)),
    );
    expect(server).toEqual([]);
  });

  it('create policies only through @liveworkspace/trusted-types', () => {
    const direct = files.filter(
      (f) => /\bcreatePolicy\(/.test(text(f)) && !f.startsWith('packages/trusted-types/'),
    );
    expect(direct).toEqual([]);
  });
});

describe('the pages', () => {
  it('boot the default policy before any other script, for the build under its asset prefix', () => {
    const layout = read(`${site}app/layout.tsx`);
    const head = layout.slice(layout.search(/^\s*<head>$/m));
    const first = head.indexOf('<script');
    expect(head.slice(first, head.indexOf('/>', first))).toContain(
      'trustedHtml(TRUSTED_TYPES_BOOT)',
    );
    expect(layout).toMatch(/trustedTypesBootScript\(SITE_ASSET_PREFIX[,)]/);
    expect(read(`${site}next.config.ts`)).toContain(`const ASSET_PREFIX = '${SITE_ASSET_PREFIX}';`);
  });

  // The header names exactly the shared policies the pages create, so no page can crash creating one it doesn't
  // name, and nothing else may make a policy.
  it('send the shared Trusted Types header on every page', () => {
    const headers = read(`${site}public/_headers`);
    expect(headers).toContain('/*\n');
    expect(headers).toContain(
      `  Content-Security-Policy: ${trustedTypesCsp([MARKUP_POLICY, INERT_PARSE_POLICY, NEXTJS_POLICY])}; frame-ancestors 'none'\n`,
    );
  });
});
