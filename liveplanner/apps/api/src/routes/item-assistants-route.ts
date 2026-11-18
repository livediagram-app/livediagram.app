// The plan's AI assistants (docs/specs/026-plan/items.md "Handing a card to an AI assistant", "Who it can be handed to";
// blueprint item-store.md "Assistants the plan remembers"): noted as a token reaches the plan's cards, and read by the
// editor's Assignee picker through GET /api/projects/:id/items/assistants.
import type { ItemAssistantsResponse } from '@liveplanner/api-schema';
import { itemPersonId } from '@liveplanner/items';
import { json } from '../responses';
import {
  knownAssistants,
  rememberAssistant,
  seenLately,
  tokenAssistant,
} from '../plan-room/known-assistants';
import { gateParticipate, type PlanRouteContext } from './context';
import type { ItemCaller } from './item-route-kit';

type Gate = typeof gateParticipate;

// Notes the calling token's assistant once a whole-project gate has passed: a token that is not read-only and names a
// tool, reaching the cards as an Editor or a Participant (a read checks that too). At most one write an hour per
// assistant; the id is worked out before any profile is read. Runs after the answer (waitUntil), and never fails it.
export async function noteAssistant(
  ctx: PlanRouteContext,
  caller: Pick<ItemCaller, 'projectId' | 'owner' | 'doc'>,
  level: 'read' | 'participate' | 'edit',
  writer: (
    ctx: PlanRouteContext,
    owner: string,
  ) => Promise<{ id: string; name: string; color: string }>,
  participates: Gate = gateParticipate,
): Promise<void> {
  const token = ctx.token;
  const name = token?.name?.trim();
  if (!token || token.readOnly || !name) return;
  try {
    const now = Date.now();
    const probe = tokenAssistant(
      { id: await itemPersonId(caller.owner), name: '', color: '#000000' },
      name,
    );
    if (!probe || (await seenLately(ctx.env, probe.id, now))) return;
    if (
      level === 'read' &&
      !(await participates(ctx, caller.projectId, caller.doc?.ownerId, caller.doc?.teamId))
    )
      return;
    const assistant = tokenAssistant(await writer(ctx, caller.owner), name);
    if (!assistant) return;
    await rememberAssistant(ctx.env, assistant, now);
    console.info('[items] assistant.noted', { projectId: caller.projectId });
  } catch (error) {
    console.warn('[items] assistant.note-failed', {
      projectId: caller.projectId,
      error: String(error),
    });
  }
}

// GET /items/assistants: the plan's remembered assistants. A tab-scoped or Community caller reads none.
export async function listAssistants(ctx: PlanRouteContext, caller: ItemCaller): Promise<Response> {
  const body: ItemAssistantsResponse = {
    assistants: caller.scope || caller.community ? [] : await knownAssistants(ctx.env),
  };
  return json(body);
}
