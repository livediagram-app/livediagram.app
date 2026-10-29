// liveworkspace status (liveworkspace/docs/specs/009-status/status.md): every service, liveworkspace's own and each app's, checked once
// an hour from Cloudflare and kept for 90 days. Its API, on liveworkspace.app/api/status, serves the latest run and the
// history; the page itself is the static site's (liveworkspace/apps/site), at liveworkspace.app/status.

import { guardRequest } from '@liveworkspace/api-kit/request-failure';
import { json, under } from '@liveworkspace/index-app/worker-http';
import { createApiRouteLabel } from '@liveworkspace/telemetry/error-tokens';
import { STATUS_API_PATH } from '@liveworkspace/status';
import { handleRead } from './api';
import type { Env } from './env';
import { runOnce } from './run';

// The route words a failure is logged under (`Get.Status.History`).
const routeLabel = createApiRouteLabel(new Set(['status']), new Set(['history']));

const worker = {
  // One guard for the whole request (liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails").
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return guardRequest(
      async () => {
        const url = new URL(request.url);
        if (under(url.pathname, STATUS_API_PATH))
          return handleRead(request, env, ctx, url.pathname.slice(STATUS_API_PATH.length));
        return new Response('Not found', { status: 404 });
      },
      () => ({ route: routeLabel(request.method, request.url), json }),
    );
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runOnce(env, event.scheduledTime).then(
        (report) => console.log(JSON.stringify({ run: 'status', ...report })),
        (err: unknown) => console.error('status run failed', err),
      ),
    );
  },
};

export default worker;
