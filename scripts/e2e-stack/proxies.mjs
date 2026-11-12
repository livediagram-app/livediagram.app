// The e2e stacks' proxies (every product's scripts/e2e-stack.mjs, through ./stack.mjs): the router's forwards to the
// index, the media service's previews (where the stack runs media) and the api worker, and the realtime room's
// WebSocket upgrade, so the app stays same-origin as in production. Dependency-free (node builtins), as the stacks are.

import http from 'node:http';
import net from 'node:net';

// The ports of this stack's api worker, index and media service (none: previews go to the api, as everything else).
export function createProxies({ apiPort, indexPort, mediaPort }) {
  const API_PORT = apiPort;
  const INDEX_PORT = indexPort;
  const MEDIA_PORT = mediaPort;
  // The router's forwards (apps/router/src/index.ts): `/api/index/*` is the index's, and `/api/previews/*`
  // liveworkspace's previews in the media service (routeToPreviews), each the same request at its origin minus this
  // site's cookies.
  const isIndexPath = (pathname) => pathname === '/api/index' || pathname.startsWith('/api/index/');
  const isPreviewsPath = (pathname) =>
    pathname === '/api/previews' || pathname.startsWith('/api/previews/');

  function proxyApi(req, res) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const toIndex = isIndexPath(pathname);
    const toPreviews = MEDIA_PORT !== undefined && isPreviewsPath(pathname);
    const port = toIndex ? INDEX_PORT : toPreviews ? MEDIA_PORT : API_PORT;
    const headers = { ...req.headers };
    if (toIndex || toPreviews) {
      delete headers.cookie;
      headers.host = `127.0.0.1:${port}`;
    }
    const proxyReq = http.request(
      {
        host: '127.0.0.1',
        port,
        method: req.method,
        path: req.url,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: toIndex
            ? 'index_unreachable'
            : toPreviews
              ? 'previews_unreachable'
              : 'api_unreachable',
        }),
      );
    });
    req.pipe(proxyReq);
  }

  // The realtime room is a WebSocket on the api (a canvas's /api/<kind>/<id>/ws). Production routes
  // the upgrade through the router like any other /api request; without this the
  // browser's socket was never answered here, so no e2e test could see a room op.
  // Relays the raw upgrade to the api worker and pipes both directions.
  function proxyApiUpgrade(req, socket, head) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/api/')) {
      socket.destroy();
      return;
    }
    const upstream = net.connect(API_PORT, '127.0.0.1', () => {
      const headerLines = [];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      }
      upstream.write(
        `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join('\r\n')}\r\n\r\n`,
      );
      if (head.length > 0) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  }

  return { proxyApi, proxyApiUpgrade };
}
