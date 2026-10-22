// FakeGoogle over HTTP, for the e2e stack: the api worker (wrangler dev)
// reaches the OAuth endpoints through GOOGLE_OAUTH_BASE_URL, and the
// browser's Drive calls are routed here by Playwright.

import { createServer, type Server } from 'node:http';
import type { FakeGoogle } from './fake-google';

export async function serveFakeGoogle(fake: FakeGoogle, port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v);
      }
      const request = new Request(`http://127.0.0.1:${port}${req.url ?? '/'}`, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      });
      fake
        .handle(request)
        .then(async (response) => {
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        })
        .catch((err: unknown) => {
          res.writeHead(500);
          res.end(String(err));
        });
    });
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return server;
}
