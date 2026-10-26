// What a share link opens, for API clients (index-adapters.ts). What it shows without opening (its live image, its
// share card and the name on its page's head) is liveworkspace's previews (liveworkspace/docs/specs/006-media/previews.md): the
// router sends `/api/share/<code>/image.svg|image.png|card` there, and they never reach this api.

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
      project: { id: item.id, name: item.title },
      role: level,
      tabId,
    });
  } catch (err) {
    return refusal(err);
  }
}
