// The site's static export as liveworkspace.app serves it, for the e2e suite (e2e/trusted-types.spec.ts): every file
// under out/, an exported page for its address (`/explorer/recent` → out/explorer/recent.html), and on every
// response the headers public/_headers gives `/*`, the Trusted Types header among them, exactly as Cloudflare's
// static assets apply them. Each app's router passes these headers through unchanged for the Explorer
// (@liveworkspace/sites/workspace-proxy), so this is also the Explorer as it is served on every app's address.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../out/', import.meta.url));
const PORT = Number(process.env.PORT ?? 3090);

/** The headers `public/_headers` sets for `/*` (the one rule it has), as name/value pairs. */
export function headersForAll(file) {
  const headers = {};
  let inAll = false;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (!/^\s/.test(line)) {
      inAll = line.trim() === '/*';
      continue;
    }
    if (!inAll) continue;
    const at = line.indexOf(':');
    headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return headers;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

if (!existsSync(OUT)) throw new Error(`[e2e] build the site first (pnpm build): no ${OUT}`);
const SITE_HEADERS = headersForAll(path.join(OUT, '_headers'));

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    const file = [p, `${p}.html`, `${p}/index.html`]
      .map((c) => path.join(OUT, c))
      .find((c) => c.startsWith(OUT) && existsSync(c) && statSync(c).isFile());
    const served = file ?? path.join(OUT, '404.html');
    res.writeHead(file ? 200 : 404, {
      ...SITE_HEADERS,
      'Content-Type': MIME[path.extname(served)] ?? 'application/octet-stream',
    });
    createReadStream(served).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`[e2e] site export on http://localhost:${PORT}`));
