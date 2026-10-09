import { readFileSync, statSync } from 'node:fs';
import { extname, normalize, resolve, sep } from 'node:path';

// The five static apps, served by the app process
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Static apps and
// routing").
//
// This is the router worker's job in the hosted deployment, and it lives here for
// the same reason the room's HTTP contract does: the rules — strip \`/live\`, send
// every \`/document/<id>\` to the one statically-built placeholder page, fall back to
// an app's index.html — are the application's, not the proxy's. Caddy terminates
// TLS and forwards; it does not restate a routing table that lives in code.

/** Where each app's \`out/\` directory sits under the static root. */
const APPS = ['marketing', 'live', 'telemetry', 'help', 'community'] as const;

/** The first path segment that belongs to the editor rather than to marketing. */
const EDITOR_PREFIXES = [
  'document',
  'explorer',
  'new',
  'join',
  'sign-in',
  'get-started',
  'embed',
  'sso-callback',
] as const;

/** Mounted under a path rather than at the root. */
const MOUNTED: Record<string, string> = {
  telemetry: 'telemetry',
  help: 'help',
  community: 'community',
};

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
};

export type StaticSiteOptions = { root: string };

/**
 * Answer a request from the built sites, or return null when nothing matches —
 * the api's own 404 is a better answer than an empty page.
 */
export function createStaticSite(options: StaticSiteOptions) {
  const root = resolve(options.root);
  const exists = (path: string): boolean => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  };
  /**
   * One file, if it exists. Next.js' static export writes \`sign-in.html\`, not
   * \`sign-in/index.html\`, so \`page()\` below tries both — and a bare directory is
   * never a page.
   */
  const read = (app: string, path: string): Response | null => {
    const full = resolve(root, app, `.${normalize(path)}`);
    // A path is a file here, so it is checked rather than trusted.
    if (full !== root && !full.startsWith(root + sep)) return null;
    if (!exists(full)) return null;
    const type = CONTENT_TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream';
    const immutable = full.includes(`${sep}_next${sep}`) || full.includes(`${sep}assets${sep}`);
    return new Response(readFileSync(full), {
      headers: {
        'Content-Type': type,
        // Hashed assets are immutable; everything else revalidates, so a deploy
        // is picked up without a hard refresh (docs/specs/016-platform/stale-builds.md).
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      },
    });
  };

  /** The three layouts an export can use for one route, in order of likelihood. */
  const page = (app: string, route: string): Response | null =>
    read(app, route.endsWith('.html') ? route : `${route}.html`) ??
    read(app, route === '/' ? '/index.html' : `${route}/index.html`) ??
    read(app, '/index.html');

  return async function serveStatic(request: Request): Promise<Response | null> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return null;
    const path = new URL(request.url).pathname.replace(/\/+/g, '/');
    // The api owns /api; a static site must never answer for it, not even with
    // its index page.
    if (path.startsWith('/api/')) return null;
    // Paths that a SERVICE answers on, not a page. A miss here has to be a 404: the
    // SPA fallback below turns an unknown path into 200 text/html, which is how a
    // probe for /mcp (or the OAuth discovery documents an MCP client asks for first)
    // came back looking like a working endpoint on a deployment that has no MCP at all.
    if (path === '/mcp' || path.startsWith('/.well-known/')) return null;
    const segments = path.split('/').filter(Boolean);
    const first = segments[0] ?? '';

    const rest = `/${segments.slice(1).join('/')}`;

    // Which app owns this path, and where it sits inside that app. The /live prefix is
    // the editor's ASSET PREFIX (next.config.ts), so stripping it has to happen before
    // anything is looked up — a chunk really is at live/_next/…, never at
    // live/live/_next/…. Getting this wrong served every chunk as the index page, which
    // the browser reports as a JSON syntax error on manifest.json and as an endless
    // reload of scripts that never arrive.
    const target =
      first === 'live'
        ? { app: 'live', route: rest }
        : first in MOUNTED
          ? { app: MOUNTED[first]!, route: rest }
          : (EDITOR_PREFIXES as readonly string[]).includes(first)
            ? // One document id per URL, one HTML file: the client reads the id from the
              // pathname (docs/specs/007-editor/new-document-route.md).
              { app: 'live', route: first === 'document' ? '/document/placeholder' : path }
            : { app: 'marketing', route: path };

    // A real file — a chunk under /_next, a font, a favicon — served as it is. Both apps
    // are tried, because the root of one holds assets the other's pages reference.
    const asset =
      read(target.app, target.route) ??
      read('live', target.route) ??
      read('marketing', target.route);
    if (asset) return asset;

    // A path that names a file IS a file: if it is missing, say so. Falling back to a
    // page here turns a 404 into HTML with the wrong content type, which is how a
    // missing chunk becomes a reload loop instead of an honest error.
    if (/\.[a-z0-9]+$/i.test(target.route)) return null;

    return (
      page(target.app, target.route) ??
      // A marketing route in a deployment that built only the editor: `/` is the app
      // people came for.
      (target.app === 'marketing' ? page('live', target.route) : null)
    );
  };
}

export { APPS };
