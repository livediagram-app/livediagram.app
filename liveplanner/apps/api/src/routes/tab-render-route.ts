// GET /api/projects/:id/tabs/:tabId/render.svg (docs/specs/015-api/api.md): one tab drawn by the shared renderer,
// read-gated like the tab itself. The CLI's `pull --svg` and `tab render` read it, so every front door draws alike.

import { getProjectMeta } from '../db';
import { notFound, svgImage } from '../responses';
import { renderTabSvg } from '../thumbnail';
import { deniedOnTab, gateRead, missingProject, type RouteContext } from './context';

// A drawing changes with every edit; it is never cached.
const NO_STORE = 'no-store';

export async function handleTabRender(ctx: RouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 6 || segments[3] !== 'tabs' || segments[5] !== 'render.svg') return null;
  if (request.method !== 'GET') return null;
  const projectId = segments[2]!;
  const tabId = segments[4]!;
  const doc = await getProjectMeta(ctx.env, projectId);
  if (!doc) return missingProject(ctx, projectId);
  if (!(await gateRead(ctx, projectId, doc.ownerId, doc.teamId, tabId)))
    return deniedOnTab(ctx, doc);
  const svg = await renderTabSvg(ctx.env, projectId, tabId);
  if (svg === null) return notFound();
  console.info('[render] tab', { projectId, tabId, bytes: svg.length, agent: ctx.token !== null });
  return svgImage(svg, NO_STORE);
}
