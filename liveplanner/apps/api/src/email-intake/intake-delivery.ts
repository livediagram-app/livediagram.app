// A message's delivery inside its plan's room (docs/specs/026-plan/email-to-board.md "Which mail is taken" steps 6 to
// 8 and "What a message makes"; blueprint email-to-board.md "Behaviour and state"): the address and its board still
// there, Who Can Send, the hour's caps, then the pictures and the card, relayed to everyone with the plan open.
import type { InboundAttachment } from '@liveworkspace/email/inbound';
import { typesOf } from '@liveplanner/items';
import { appendItemHistory } from '../db/item-history';
import { parseTypes } from '../plan-room/plan-cards-push';
import { ANONYMOUS } from '../plan-room/plan-route';
import { createMany } from '../routes/item-routes';
import { relay } from '../routes/item-route-kit';
import type { PlanRouteContext } from '../routes/context';
import { reportServerEvent } from '../server-telemetry';
import type { PlanEnv } from '../types';
import { intakeBoardsOf, intakeTargetOf } from './intake-boards';
import { emailCardCreate, emailPerson } from './intake-card';
import { senderHash } from './intake-code';
import { planMemberAddresses } from './intake-members';
import { attachPictures } from './intake-pictures';
import { countIntake, intakeByCode, takeIntakeHour } from './intake-store';

/** A message the worker read, for the room to take: or only the news that one failing its checks was dropped. */
export type IntakeDelivery =
  | {
      code: string;
      sender: string;
      subject: string;
      text: string;
      attachments: InboundAttachment[];
    }
  | { code: string; dropped: true };

export type IntakeOutcome =
  'made' | 'counted' | 'gone' | 'refused_sender' | 'busy' | 'unavailable' | 'failed';

/** What the room lends a delivery: its env, whether its plan is put away, its picture grants and its write's tail. */
export type IntakeRoom = {
  env: PlanEnv;
  putAway: boolean;
  grant: (imageId: string) => void;
  wrote: () => void;
  waitUntil: (promise: Promise<unknown>) => void;
};

// The item store's doors take a route's context: here it is no one's, inside the room.
function roomContext(room: IntakeRoom): PlanRouteContext {
  const url = new URL('https://email-intake.internal/');
  return {
    request: new Request(url),
    env: room.env,
    url,
    segments: [],
    accountUserId: ANONYMOUS.accountUserId,
    verifiedUserId: ANONYMOUS.verifiedUserId,
    accountEmail: ANONYMOUS.accountEmail,
    resolveOwner: () => null,
    token: null,
    workbench: null,
    teams: null,
    bearer: null,
    grant: null,
    waitUntil: room.waitUntil,
  };
}

type PlanRow = { owner_id: string; team_id: string | null; item_types: string | null };

/** The delivery taken, or why not. */
export async function deliverIntake(
  room: IntakeRoom,
  planId: string,
  delivery: IntakeDelivery,
  now: number,
): Promise<IntakeOutcome> {
  const { env } = room;
  if (room.putAway) return 'gone';
  const intake = await intakeByCode(env, planId, delivery.code);
  if (!intake) return 'gone';
  if ('dropped' in delivery) {
    await countIntake(env, intake.code, 'dropped', now);
    return 'counted';
  }
  const plan = await env.PLAN_DB.prepare(
    'SELECT owner_id, team_id, item_types FROM plan WHERE id = ?',
  )
    .bind(planId)
    .first<PlanRow>();
  if (!plan) return 'gone';
  const types = typesOf(parseTypes(plan.item_types));
  const boards = await intakeBoardsOf(env, planId, types);
  const board = boards.find((b) => b.id === intake.boardId);
  if (!board) return 'gone';
  // What it makes: its own card type and column, or (an address from before) its board's first of each. Judged
  // against every board, as the card shows on whichever takes its type: none showing it, and the mail is refused
  // rather than made where nobody sees it.
  const target = intakeTargetOf(intake.target ?? board.place, boards, types);
  if (!target) return 'gone';
  const sender = delivery.sender.toLowerCase();
  if (intake.senders === 'members') {
    const members = await planMemberAddresses(env, plan.owner_id, plan.team_id);
    if (members === 'unavailable') return 'unavailable';
    if (!members.has(sender)) {
      await countIntake(env, intake.code, 'refused', now);
      return 'refused_sender';
    }
  }
  const hash = await senderHash(sender);
  if (!(await takeIntakeHour(env, intake.code, hash, now))) return 'busy';
  const pictures = await attachPictures(
    env,
    { id: planId, ownerId: plan.owner_id },
    delivery.attachments,
    room.grant,
  );
  const create = emailCardCreate({
    subject: delivery.subject,
    text: delivery.text,
    sender,
    attached: pictures.attached,
    dropped: pictures.dropped,
    typeId: target.typeId,
    status: target.status,
  });
  if (typeof create === 'string') {
    console.error('[email-intake] card.unmade', { rejection: create });
    return 'failed';
  }
  const by = emailPerson(sender, hash);
  const ctx = roomContext(room);
  const made = await createMany(ctx, { projectId: planId, owner: by.id }, [create], { by });
  if (made instanceof Response) return made.status === 413 ? 'failed' : 'busy';
  relay(ctx, planId, made.items, [], made.rev);
  // One created event for the card: Card Created and Email Received rules both hear it (automations.md "Email
  // Received"), each running once.
  await appendItemHistory(
    env,
    planId,
    made.items.map((after) => ({ before: null, after })),
    'email',
    { role: 'system', email: { from: sender, board: board.id } },
  );
  room.wrote();
  await countIntake(env, intake.code, 'made', now);
  room.waitUntil(reportServerEvent(env, 'Plan', 'Created', 'EmailCard'));
  return 'made';
}
