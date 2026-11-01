// Download Your Data's service (liveworkspace/docs/specs/003-accounts/data-export.md): the internal routes accounts
// calls (routes.ts), and the Durable Object that builds each export (job/durable-object.ts). A Worker entry exports its
// handler and its object's class alone.

import type { Env } from './env';
import type { ExportObject } from './routes';
import { handle } from './routes';

export { DataExport } from './job/durable-object';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handle(request, {
        key: env.EXPORT_KEY_ACCOUNTS,
        object: (key) => {
          if (!env.DATA_EXPORT) throw new Error('export: no DATA_EXPORT binding');
          return env.DATA_EXPORT.get(env.DATA_EXPORT.idFromName(key)) as unknown as ExportObject;
        },
        file: async (r2Key) => {
          const object = await env.EXPORTS?.get(r2Key);
          return object ? { body: object.body, size: object.size } : null;
        },
        now: () => Date.now(),
      });
    } catch (err) {
      console.error('[export] request failed', String(err));
      return Response.json({ error: 'unavailable' }, { status: 503 });
    }
  },
};
