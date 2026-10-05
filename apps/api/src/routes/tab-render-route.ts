// GET /api/documents/:id/tabs/:tabId/render.svg (docs/specs/015-api/api.md): one tab drawn by the shared renderer,
// read-gated like the tab itself. The CLI's `pull --svg` and `tab render` read it, so every front door draws alike.

import { getDocumentMeta } from '../db';
import { notFound, svgImage } from '../responses';
import { renderTabSvg } from '../thumbnail';
import { deniedOnTab, gateRead, missingDocument, type RouteContext } from './context';

// A drawing changes with every edit; it is never cached.
const NO_STORE = 'no-store';

export async function handleTabRender(ctx: RouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 6 || segments[3] !== 'tabs' || segments[5] !== 'render.svg') return null;
  if (request.method !== 'GET') return null;
  const documentId = segments[2]!;
  const tabId = segments[4]!;
  const doc = await getDocumentMeta(ctx.env, documentId);
  if (!doc) return missingDocument(ctx, documentId);
  if (!(await gateRead(ctx, documentId, doc.ownerId, doc.teamId, tabId)))
    return deniedOnTab(ctx, doc);
  const svg = await renderTabSvg(ctx.env, documentId, tabId);
  if (svg === null) return notFound();
  console.info('[render] tab', { documentId, tabId, bytes: svg.length, agent: ctx.token !== null });
  return svgImage(svg, NO_STORE);
}
