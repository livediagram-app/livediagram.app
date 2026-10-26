// liveworkspace status (liveworkspace/docs/specs/009-status/status.md): every service, liveworkspace's own and each app's, checked once
// an hour from Cloudflare and kept for 90 days. Its API, on liveworkspace.app/api/status, serves the latest run and the
// history; the page itself is the static site's (liveworkspace/apps/site), at liveworkspace.app/status.

import { under } from '@liveworkspace/index-app/worker-http';
import { STATUS_API_PATH } from '@liveworkspace/status';
import { handleRead } from './api';
import type { Env } from './env';
import { runOnce } from './run';

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (under(url.pathname, STATUS_API_PATH))
      return handleRead(request, env, ctx, url.pathname.slice(STATUS_API_PATH.length));
    return new Response('Not found', { status: 404 });
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
