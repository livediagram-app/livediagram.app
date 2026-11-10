import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  INERT_PARSE_POLICY,
  MARKUP_POLICY,
  NEXTJS_POLICY,
  trustedTypesCsp,
} from '@liveworkspace/trusted-types/csp';
import { escapesUnlisted, usesEscapeHatch } from '@liveworkspace/trusted-types/sinks-suite';
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

// The site's own code and the shared packages its pages render (the Explorer among them). The tooling
// configs (prettier-config, vitest-config, oxlint-config, next-config) have no src/: nothing of theirs renders.
const files = [
  ...['app', 'components', 'lib'].flatMap((d) => sources(`${site}${d}`)),
  ...readdirSync(`${root}packages`)
    .filter((p) => existsSync(`${root}packages/${p}/src`))
    .flatMap((p) => sources(`${root}packages/${p}/src`)),
].map((f) => f.slice(root.length));
const text = (f: string) => read(`${root}${f}`);

// The markup sinks a file feeds: htmlProps, the one way a React element is given markup. That every sink goes through
// @liveworkspace/trusted-types's html.ts at all is the repository's raw HTML guard (.github/scripts/raw-html-guard.mjs).
const htmlExpressions = (source: string) => [...source.matchAll(/\{\.\.\.htmlProps\(/g)];

// Markup fed in unsanitised through the escape hatch (trustedConstant, builtMarkup) outside a layout: the random
// UUID boot script. The Explorer's silent sign-in script comes from its layout, and the JSON-LD block is jsonScript's
// (JSON with < escaped). Everything else goes through sanitizedHtml.
const BUILDER_MARKUP = ['packages/ui/src/random-uuid-boot.ts'];

describe('Trusted Types sinks', () => {
  // The policy only proves markup went through it; the sanitiser makes people's markup safe. The trusted-types
  // package itself defines the helpers, so it is the one place outside the list that names the escape hatch.
  it('use the escape hatch (trustedConstant, builtMarkup) only in a layout or a listed builder file', () => {
    expect(
      files.filter(
        (f) =>
          !f.startsWith('packages/trusted-types/') && escapesUnlisted(f, text(f), BUILDER_MARKUP),
      ),
    ).toEqual([]);
    // A listed file that no longer uses it comes off the list, so the list never allows more than it needs.
    expect(BUILDER_MARKUP.filter((f) => !files.includes(f) || !usesEscapeHatch(text(f)))).toEqual(
      [],
    );
  });

  // A server component's htmlProps runs in the prerender, where there are no Trusted Types, so a client render
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
    expect(head.slice(first, head.indexOf('/>', first))).toContain('htmlProps(TRUSTED_TYPES_BOOT)');
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
