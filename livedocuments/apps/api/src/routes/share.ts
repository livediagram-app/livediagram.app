// What a share link opens, for API clients (index-adapters.ts). What it shows without opening (its live image and
// preview card) is liveworkspace's (liveworkspace/docs/previews.md): the router sends `/api/share/<code>/image.svg|
// image.png|card` there, and the service asks the export door (routes/internal-items.ts) for the drawing.

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
      document: { id: item.id, name: item.title },
      role: level,
      tabId,
    });
  } catch (err) {
    return refusal(err);
  }
}
