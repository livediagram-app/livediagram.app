// The local gateway: the first Worker of a one-process `wrangler dev` (./start.mjs), and the only one wrangler gives a
// port. ./forward.mjs pipes each Worker's own port to it unchanged, so the request still names the port it came in on,
// and this hands it to that Worker over a service binding, under the origin the Worker saw when it ran alone. Local only:
// its config is written at run time, never a wrangler.toml, so CI never deploys it (docs/ci.md "Deploys").
//
// ROUTES (a var ./start.mjs writes): { "<port>": { "binding": "<service binding>", "origin": "http://localhost:<port>" } }

/** The route for a request, by the port in its URL or, failing that, its Host header. */
export function routeFor(request, routes) {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? '';
  const port = url.port || host.split(':')[1] || '';
  return routes[port] ?? routes[host.split(':')[1] ?? ''] ?? null;
}

export default {
  async fetch(request, env) {
    const routes = JSON.parse(env.ROUTES);
    const route = routeFor(request, routes);
    if (!route) {
      return new Response(`No local Worker answers on ${request.headers.get('host')}`, {
        status: 404,
      });
    }
    const worker = env[route.binding];
    const url = new URL(request.url);
    // `wrangler dev --test-scheduled` answered /__scheduled for one Worker alone; here every Worker's cron runs on
    // its own port, through the binding's scheduled().
    if (url.pathname === '/__scheduled') {
      const cron = url.searchParams.get('cron') ?? undefined;
      await worker.scheduled({ scheduledTime: Date.now(), cron });
      return new Response('Ran scheduled event');
    }
    const target = new URL(url.pathname + url.search, route.origin);
    return worker.fetch(new Request(target, request));
  },
};
