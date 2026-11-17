// An assigned action's status from outside the editor (docs/specs/012-collaboration/assigned-actions.md "From the
// Inbox"): POST /api/documents/:id/tabs/:tabId/actions/:actionId/status with `{ elementId, status }`. Anyone with
// edit access may complete, reopen or close an action, as in the editor. The write goes through the tab's revision
// (writeTab, shared with the comment routes) and reaches the room as an `action-status` delta, so open editors
// update in place.

import { logRefusal } from '@liveworkspace/api-kit/refusal-log';
import { ACTION_STATUSES, withActionStatus, type ElementActionStatus } from '@livediagram/document';
import { getDocument } from '../db';
import { badRequest, methodNotAllowed, noContent, notFound } from '../responses';
import { deniedEdit, gateEdit, missingDocument, readBody, requireOwner } from './context';
import type { DocumentRouteContext } from './context';
import { writeTab } from './comment-routes';

const isStatus = (v: unknown): v is ElementActionStatus =>
  typeof v === 'string' && (ACTION_STATUSES as readonly string[]).includes(v);

async function setStatus(
  ctx: DocumentRouteContext,
  id: string,
  tabId: string,
  actionId: string,
): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(ctx.env, id);
  if (!doc) return missingDocument(ctx, id);
  if (!(await gateEdit(ctx, id, doc.ownerId, doc.teamId, tabId))) return deniedEdit(ctx, id, tabId);
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const { elementId, status } = body;
  if (typeof elementId !== 'string' || !elementId) return badRequest('missing elementId');
  if (!isStatus(status)) return badRequest('invalid status');
  const at = Date.now();
  const written = await writeTab(ctx, id, tabId, (tab) => {
    const index = tab.elements.findIndex((el) => el.id === elementId);
    if (index < 0) return notFound();
    const before = tab.elements[index]!;
    const after = withActionStatus(before, actionId, status, at);
    if (after === before) {
      // No such action on it, or it already has that status.
      const e = before as { action?: { id: string }; actions?: { id: string }[] };
      const has = e.action?.id === actionId || e.actions?.some((a) => a.id === actionId);
      return has ? 'unchanged' : notFound();
    }
    const elements = tab.elements.slice();
    elements[index] = after;
    return { elements, elementId, delta: { kind: 'action-status', actionId, status, at } };
  });
  if (written instanceof Response) return written;
  console.info(`[actions] ${written.change ? status : 'unchanged'}`, {
    documentId: id,
    tabId,
    agent: ctx.token !== null,
  });
  return noContent();
}

// The action routes, or null for a path that is not theirs. Every refusal is logged here, once.
export async function handleActionRoutes(ctx: DocumentRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 8 || segments[3] !== 'tabs' || segments[5] !== 'actions') return null;
  if (segments[7] !== 'status') return null;
  const res =
    request.method === 'POST'
      ? await setStatus(ctx, segments[2]!, segments[4]!, segments[6]!)
      : methodNotAllowed();
  if (res.status >= 400)
    await logRefusal('[actions] refused', res, {
      documentId: segments[2],
      tabId: segments[4] ?? null,
      route: 'status',
      agent: ctx.token !== null,
    });
  return res;
}
