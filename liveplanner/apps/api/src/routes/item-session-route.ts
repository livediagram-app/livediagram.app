// POST /items/:itemId/session (docs/specs/026-plan/session-tabs.md "History", blueprint session-tabs.md "Interfaces
// and contracts"): a Session tab's outcome for a card, kept in the card's history as an entry of its own, tagged
// `session`. It writes nothing on the card, so a skip leaves its Last Edited alone; the move a Refined, Committed,
// Accepted or Closed makes, the flag a Flagged sets and a duplicate's link are their own writes. A Close may carry its
// reason and the card it duplicates, a Stand-up's Flagged its Blocked reason; `undone` records an outcome taken back. Edit access: running a session is an
// Editor's.
import {
  SESSION_REASON_MAX,
  isSessionKindId,
  isSessionOutcome,
  outcomeFits,
  reasonFits,
  sessionReason,
  type ItemHistoryChange,
} from '@liveplanner/items';
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
  const { session, outcome, reason, duplicateOf, undone } = body;
  if (!isSessionKindId(session)) return rejected('session_invalid', 'session');
  // An outcome its kind does not offer (Committed in a Refinement) is as unknown as a made-up one.
  if (!isSessionOutcome(outcome) || !outcomeFits(session, outcome))
    return rejected('session_invalid', 'outcome');
  // A reason is a Close's or a Stand-up Flagged's; a duplicate a Close's alone.
  const closing = outcome === 'closed';
  if (
    reason !== undefined &&
    (!reasonFits(session, outcome) ||
      typeof reason !== 'string' ||
      reason.length > SESSION_REASON_MAX)
  )
    return rejected('session_invalid', 'reason');
  if (
    duplicateOf !== undefined &&
    (!closing ||
      typeof duplicateOf !== 'string' ||
      duplicateOf === itemId ||
      (caller.scope && !caller.scope.has(duplicateOf)))
  )
    return rejected('session_invalid', 'duplicateOf');
  if (undone !== undefined && undone !== true) return rejected('session_invalid', 'undone');
  const item = await readItem(ctx.env, projectId, itemId);
  if (!item) return itemNotFound();
  if (typeof duplicateOf === 'string' && !(await readItem(ctx.env, projectId, duplicateOf)))
    return rejected('session_invalid', 'duplicateOf');
  const why = sessionReason(reason);
  const change: ItemHistoryChange = {
    kind: 'session',
    session,
    outcome,
    ...(why ? { reason: why } : {}),
    ...(typeof duplicateOf === 'string' ? { duplicateOf } : {}),
    ...(undone ? { undone: true as const } : {}),
  };
  const by = await writer(ctx, caller.owner);
  const kept = await appendItemHistory(
    ctx.env,
    projectId,
    [
      {
        before: item,
        after: { ...item, updatedBy: by, updatedAt: Date.now() },
        changes: [change],
      },
    ],
    'session',
  );
  console.info('[session] outcome.recorded', { projectId, outcome, undone: !!undone, kept });
  return noContent();
}
