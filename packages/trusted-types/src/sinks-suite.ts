// The Trusted Types sink checks every app runs over its own sources (livediagram/docs/specs/016-platform/trusted-types.md):
// every sink mints its TrustedHTML in the browser, every page boots the default policy first, and every app sends the
// header, and markup goes in unsanitised only from the files a product lists. That every sink goes through html.ts at
// all is the repository's raw HTML guard (.github/scripts/raw-html-guard.mjs). Written once here; each app's
// `packages/ui/src/trusted-types-sinks.test.ts` calls it with its own layout.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

export type TrustedTypesSinkOptions = {
  /** The product's root folder (the one holding `apps/` and `packages/`), ending in `/`. */
  root: string;
  /** The Next.js apps whose pages must boot the default policy and send the header. */
  apps: readonly string[];
  /** The app that is a client app end to end and sends its header from `src/worker.ts`. */
  editorApp: string;
  /** The header the product's pages send. */
  csp: string;
  /** Files (by path suffix) that may call `new DOMParser()` themselves: the inert parse policy's own module. */
  domParserAllowed?: readonly string[];
  /**
   * Files (by path, from the product root) that may use the escape hatch (`trustedConstant`, `builtMarkup`) besides
   * a layout: our own build-time scripts and constants, and markup built by our own escaping builders from typed data
   * (catalogue icons and stickers, device frames, a look's sample preview, the face-finish ink). Everything else goes
   * through `sanitizedHtml`.
   */
  builderMarkup?: readonly string[];
};

const SKIPPED_DIRS = ['node_modules', 'out', 'dist', 'e2e', 'test-results', 'scripts'];

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIPPED_DIRS.includes(name) || name.startsWith('.')) continue;
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

// The markup sinks a file feeds (html.ts's htmlProps, the one way a React element is given markup).
const htmlExpressions = (source: string) => [...source.matchAll(/\{\.\.\.htmlProps\(/g)];

// The escape hatch: the `SafeHtml` constructors that vet nothing (html.ts), for our own constants and our escaping
// builders' output. `jsonScript` escapes what it holds and `sanitizedHtml` sanitises, so neither is one.
const ESCAPE_HATCH = /\b(?:trustedConstant|builtMarkup)\(/;
// A layout's inline boot scripts are static text of ours, written into a <script>: never sanitised (they are script).
// A layout is a layout.tsx under an app/ folder at any depth, checked segment by segment (linear in the path's
// length; a regex over the path backtracks polynomially on many app/ segments).
export function isLayoutFile(file: string): boolean {
  const segments = file.split('/');
  return segments.pop() === 'layout.tsx' && segments.includes('app');
}

/** Whether a file uses the escape hatch (`trustedConstant`, `builtMarkup`). */
export function usesEscapeHatch(source: string): boolean {
  return ESCAPE_HATCH.test(source);
}

/** Whether a file uses the escape hatch where it may not: outside a layout and the listed builders. */
export function escapesUnlisted(
  file: string,
  source: string,
  builders: readonly string[],
): boolean {
  return usesEscapeHatch(source) && !isLayoutFile(file) && !builders.includes(file);
}

export function describeTrustedTypesSinks(options: TrustedTypesSinkOptions): void {
  const { root, apps, editorApp, csp, domParserAllowed = [], builderMarkup = [] } = options;
  const cache = new Map<string, string>();
  const read = (path: string) => {
    let text = cache.get(path);
    if (text === undefined) cache.set(path, (text = readFileSync(`${root}${path}`, 'utf8')));
    return text;
  };
  const editorPrefix = `apps/${editorApp}/`;
  const files = ['apps', 'packages']
    .flatMap((d) => sources(`${root}${d}`))
    .map((f) => f.slice(root.length));

  describe('Trusted Types sinks', () => {
    // The policy only proves markup went through it; the sanitiser is what makes people's markup safe. So the
    // escape hatch stays with the layouts' boot scripts and the files listed as our own or builder markup, and a new
    // sink of a document's drawing, an import or anything from the network has to be sanitised.
    it('use the escape hatch (trustedConstant, builtMarkup) only in a layout or a listed builder file', () => {
      expect(files.filter((f) => escapesUnlisted(f, read(f), builderMarkup))).toEqual([]);
      // A listed file that no longer uses it comes off the list, so the list never allows more than it needs.
      expect(builderMarkup.filter((f) => !files.includes(f) || !usesEscapeHatch(read(f)))).toEqual(
        [],
      );
    });

    // A server component's `htmlProps` runs in the prerender, where there is no Trusted Types, so the RSC payload
    // carries a plain string; a client navigation then writes it through innerHTML and the default policy refuses
    // it, crashing the page to blank (the help centre's breadcrumbs did this to every page). So outside the editor
    // (a client app end to end) a sink lives in a root layout (never re-rendered on navigation), a 'use client'
    // module, or an app module only client modules import.
    it('mint TrustedHTML in the browser, never in a server component', () => {
      const isClient = (f: string) => read(f).startsWith("'use client';");
      const isLayout = (f: string) => /^apps\/[^/]+\/app\/layout\.tsx$/.test(f);
      const sinks = files.filter(
        (f) => !f.startsWith(editorPrefix) && htmlExpressions(read(f)).length > 0,
      );
      // Who imports a module, by its path without extension (relative or `@/` specifiers).
      const importers = (target: string) =>
        files.filter((f) => {
          if (f.startsWith(editorPrefix)) return false;
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

    // No policy lets a hand-made DOMParser through, except the inert parse policy's own module where an app has one.
    it('parse files with DOMParser only where the inert parse policy allows it', () => {
      const direct = files.filter(
        (f) =>
          /\bnew DOMParser\(\)/.test(read(f)) &&
          !domParserAllowed.some((allowed) => f.endsWith(allowed)),
      );
      expect(direct).toEqual([]);
    });
  });

  describe.each(apps)('apps/%s', (app) => {
    it('boots the default policy before any other script', () => {
      const layout = read(`apps/${app}/app/layout.tsx`);
      // The JSX <head> element (a line of its own), then the first <script> inside it.
      const head = layout.slice(layout.search(/^\s*<head>$/m));
      const first = head.indexOf('<script');
      expect(head.slice(first, head.indexOf('/>', first))).toContain(
        'htmlProps(TRUSTED_TYPES_BOOT)',
      );
      // Its own build's scripts, under the prefix next.config.ts serves them from (basePath or assetPrefix).
      const config = read(`apps/${app}/next.config.ts`);
      // A help app takes its basePath from @liveworkspace/help-site's withHelpSite.
      const prefix =
        /(?:basePath|assetPrefix): '([^']+)'/.exec(config)?.[1] ??
        (/\bwithHelpSite\(/.test(config) ? '/help' : '');
      // On one line, or split where the editor also names other script origins.
      expect(layout).toMatch(
        new RegExp(`const TRUSTED_TYPES_BOOT = trustedTypesBootScript\\(\\s*'${prefix}'[,)]`),
      );
    });

    it('sends the Trusted Types header on every page', () => {
      if (app === editorApp) {
        const worker = read(`apps/${editorApp}/src/worker.ts`);
        expect(worker).toMatch(/'Content-Security-Policy':\s*TRUSTED_TYPES_CSP/);
      } else {
        const headers = read(`apps/${app}/public/_headers`);
        expect(headers).toContain(`/*\n`);
        expect(headers).toContain(`  Content-Security-Policy: ${csp}\n`);
      }
    });
  });
}
