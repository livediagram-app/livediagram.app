// POST /items/:itemId/session (docs/specs/026-plan/session-tabs.md "History", blueprint session-tabs.md "Interfaces
// and contracts"): a Session tab's outcome for a card, kept in the card's history as an entry of its own, tagged
// `session`. It writes nothing on the card, so a skip leaves its Last Edited alone; the move a Refined makes and the
// flag a Flagged sets are their own writes. Edit access: running a session is an Editor's.
import { isSessionKindId, isSessionOutcome } from '@liveplanner/items';
import { appendItemHistory } from '../db/item-history';
import { readItem } from '../db';
import { methodNotAllowed, noContent } from '../responses';
import { readBody, type PlanRouteContext } from './context';
import { itemCaller, itemNotFound, rejected, writer } from './item-route-kit';

export async function recordSessionOutcome(
  ctx: PlanRouteContext,
  projectId: string,
  itemId: string,
): Promise<Response> {
  if (ctx.request.method !== 'POST') return methodNotAllowed();
  const caller = await itemCaller(ctx, projectId, 'edit');
  if (caller instanceof Response) return caller;
  if (caller.scope && !caller.scope.has(itemId)) return itemNotFound();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const { session, outcome } = body as { session?: unknown; outcome?: unknown };
  if (!isSessionKindId(session)) return rejected('session_invalid', 'session');
  if (!isSessionOutcome(outcome)) return rejected('session_invalid', 'outcome');
  const item = await readItem(ctx.env, projectId, itemId);
  if (!item) return itemNotFound();
  const by = await writer(ctx, caller.owner);
  const kept = await appendItemHistory(
    ctx.env,
    projectId,
    [
      {
        before: item,
        after: { ...item, updatedBy: by, updatedAt: Date.now() },
        changes: [{ kind: 'session', session, outcome }],
      },
    ],
    'session',
  );
  console.info('[session] outcome.recorded', { projectId, outcome, kept });
  return noContent();
}
