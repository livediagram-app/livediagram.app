// What a share link opens, for API clients (index-adapters.ts), and what it shows without opening (share-preview.ts).

import { notFound, json } from '../responses';
import type { RouteContext } from './context';
import { clientFor, refusal } from './index-adapters';
import { handleSharePreview } from './share-preview';

// GET /api/share/:code.
export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  // The live image and the link preview's doors (share-preview.ts).
  const preview = await handleSharePreview(ctx);
  if (preview) return preview;
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
