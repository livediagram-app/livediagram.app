// Every page that can draw a person's avatar must let Google's profile pictures load
// (liveworkspace/docs/accounts.md "Profile pictures", "The Content-Security-Policy"). Today the pages send Trusted
// Types alone, with no `img-src` or `default-src`, so every image origin is allowed. Should either arrive, in a
// static site's `_headers` or a Worker that serves pages, it must name Google's image host, or every avatar would
// quietly fall back to initials.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PROFILE_PICTURE_HOST, PROFILE_PICTURE_ORIGIN } from './picture';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRODUCTS = ['liveworkspace', 'livediagram', 'liveplanner', 'livedocuments', 'livedesign'];
const SKIPPED = new Set(['node_modules', 'out', 'dist', '.next', '.open-next', '.wrangler', 'e2e']);

// Responses that are an SVG picture, never a page that draws avatars: their own locked-down CSP stays.
const IMAGE_ONLY = ['liveworkspace/apps/media/src/previews/routes.ts'];

/** Whether a Content-Security-Policy lets an <img> load from `origin`: `img-src` decides, else `default-src`, else
 *  anything goes. */
function cspAllowsImages(csp: string, origin: string): boolean {
  const directives = new Map(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map((parts) => [parts[0]!.toLowerCase(), parts.slice(1)] as const),
  );
  const sources = directives.get('img-src') ?? directives.get('default-src');
  if (!sources) return true;
  const host = new URL(origin).hostname;
  return sources.some(
    (s) =>
      s === '*' ||
      s === 'https:' ||
      s === origin ||
      s === `${origin}/` ||
      (s.startsWith('https://*.') && host.endsWith(s.slice('https://*'.length))),
  );
}

function walk(dir: string, keep: (path: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIPPED.has(name) || name.startsWith('.')) continue;
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) walk(path, keep, out);
    else if (keep(path)) out.push(path);
  }
  return out;
}

const appsOf = (product: string) => walk(`${ROOT}${product}/apps`, () => true);
const relative = (path: string) => path.slice(ROOT.length);

describe('cspAllowsImages', () => {
  it('reads img-src, then default-src, then allows', () => {
    expect(cspAllowsImages("require-trusted-types-for 'script'", PROFILE_PICTURE_ORIGIN)).toBe(
      true,
    );
    expect(cspAllowsImages("img-src 'self' data:", PROFILE_PICTURE_ORIGIN)).toBe(false);
    expect(
      cspAllowsImages(`img-src 'self' ${PROFILE_PICTURE_ORIGIN}`, PROFILE_PICTURE_ORIGIN),
    ).toBe(true);
    expect(cspAllowsImages("default-src 'self'", PROFILE_PICTURE_ORIGIN)).toBe(false);
    expect(cspAllowsImages("default-src 'self'; img-src https:", PROFILE_PICTURE_ORIGIN)).toBe(
      true,
    );
    expect(cspAllowsImages('img-src https://*.googleusercontent.com', PROFILE_PICTURE_ORIGIN)).toBe(
      true,
    );
    expect(PROFILE_PICTURE_ORIGIN).toBe(`https://${PROFILE_PICTURE_HOST}`);
  });
});

describe("the pages' Content-Security-Policy", () => {
  const files = PRODUCTS.flatMap(appsOf);

  it("lets every static site's pages load Google's profile pictures", () => {
    const headers = files.filter((f) => f.endsWith('/public/_headers'));
    // liveworkspace.app and every product's marketing and help sites, at least.
    expect(headers.length).toBeGreaterThanOrEqual(9);
    const blocked = headers.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/^\s*Content-Security-Policy:\s*(.+)$/gim)]
        .filter((m) => !cspAllowsImages(m[1]!, PROFILE_PICTURE_ORIGIN))
        .map(() => relative(f)),
    );
    expect(blocked).toEqual([]);
  });

  it('lets every Worker that serves pages load them too', () => {
    const sources = files.filter(
      (f) =>
        /\/src\/.*\.ts$/.test(f) && !/\.test\.ts$/.test(f) && !IMAGE_ONLY.includes(relative(f)),
    );
    expect(sources.length).toBeGreaterThan(50);
    const blocked = sources.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/['"`]([^'"`]*\b(?:img|default)-src\b[^'"`]*)['"`]/g)]
        .filter((m) => !cspAllowsImages(m[1]!, PROFILE_PICTURE_ORIGIN))
        .map((m) => `${relative(f)}: ${m[1]}`),
    );
    expect(blocked).toEqual([]);
  });
});
