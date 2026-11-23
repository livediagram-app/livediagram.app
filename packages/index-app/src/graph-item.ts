// The apps' graph door (liveworkspace/docs/specs/004-index/send-to-diagram.md; POST /api/internal/items/from-graph,
// the index's key alone): Send to Diagram's new item for `owner`, drawn from a graph another app's AI drafted. The body
// is read again here (readDiagramFromGraphInput: the caps, plain text, a web link), then the app's handler makes it.

import { readDiagramFromGraphInput } from '@liveworkspace/index-client';
import type { InternalItemHandlers } from './internal-contract';
import { USER_ID, badRequest, bodyOf, json } from './internal-doors';

export async function graphDoor(
  request: Request,
  run: NonNullable<InternalItemHandlers['fromGraph']>,
): Promise<Response> {
  const body = await bodyOf(request);
  if (!body) return badRequest('body must be a JSON object');
  const input = readDiagramFromGraphInput(body);
  if (!input) return badRequest('body must be {owner, name, graph, caption, link}');
  if (!USER_ID.test(input.owner)) return badRequest('owner must be an account id');
  let result;
  try {
    result = await run(input);
  } catch (err) {
    console.error('[internal] graph item failed', { error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
  if (result.status !== 'ok') {
    console.warn('[internal] graph item refused', { status: result.status });
    const status = result.status === 'too_large' ? 413 : result.status === 'not_found' ? 404 : 422;
    return json({ error: result.status }, status);
  }
  console.info('[internal] graph item made', {
    id: result.id,
    into: input.tabId ? 'tab' : input.itemId ? 'new-tab' : 'new',
    nodes: input.graph.nodes.length,
    edges: input.graph.edges.length,
  });
  return json({ id: result.id, ...(result.tabId ? { tabId: result.tabId } : {}) }, 201);
}
