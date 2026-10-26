// What a share link opens, for API clients (index-adapters.ts). What a link shows without opening (its live image,
// its share card and the name a link preview reads) is liveworkspace's (liveworkspace/docs/specs/006-media/previews.md): the router
// sends `/api/share/<code>/image.svg|image.png|card` there, and the design only draws (routes/internal-items.ts, the
// export door).

import { notFound, json } from '../responses';
import type { RouteContext } from './context';
import { clientFor, refusal } from './index-adapters';

// GET /api/share/:code.
export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  const code = segments[2];
  if (!code || segments.length !== 3 || request.method !== 'GET') return notFound();
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  try {
    const password = request.headers.get('X-Share-Password');
    const { item, level, tabId } = await client.resolveShare(code, password);
    return json({
      design: { id: item.id, name: item.title },
      role: level,
      tabId,
    });
  } catch (err) {
    return refusal(err);
  }
}
