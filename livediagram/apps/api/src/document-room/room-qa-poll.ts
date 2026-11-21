import {
  POLL_ENDED_EVENT,
  QUESTION_ASKED_EVENT,
  QUESTION_DATA,
  QUESTION_TEXT_MAX,
} from '@livediagram/document/automations';
import { writeQaAction, type QaWriteRequest } from '../qa-board-write';
import type { SessionAttachment } from '../room-session';
import type { ParticipantPresence } from '../types';
import { cutTo, hearsEvent, queueEvent, roleOfLevel } from '@liveworkspace/automations/room';
import { pollEndedEvent } from './automations/poll-event';
import type { DocumentRoom } from './document-room';

// The room's Q&A board writes and live poll answers (document-room.ts): each function takes the room it acts for.

// One Q&A board write, queued behind every other one for this document
// (docs/specs/012-collaboration/qa-board.md). Reached only from the api worker's qa route, which has already
// checked access and derived the actor, so the body is trusted the same way
// /broadcast's is. The broadcast happens INSIDE the queued step, so peers
// receive board states in rev order.
export async function handleQaWrite(room: DocumentRoom, request: Request): Promise<Response> {
  const env = room.roomEnv;
  if (!env) return new Response('no env', { status: 503 });
  let req: QaWriteRequest;
  try {
    req = await request.json<QaWriteRequest>();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const step = room.queueTabWrite(async () => {
    const result = await writeQaAction(env, req);
    if (result.ok && result.changed) {
      // Question Asked (docs/specs/013-workspace/automations.md): a note added, with its text and nobody's name,
      // queued in the same stretch as the write that added it.
      if (req.action.type === 'add')
        queueEvent(env, {
          id: `question:${req.elementId}:${req.action.id}`,
          kind: QUESTION_ASKED_EVENT,
          at: Date.now(),
          tab: req.tabId,
          data: { [QUESTION_DATA]: cutTo(req.action.text.trim(), QUESTION_TEXT_MAX) },
        });
      room.broadcastOrderedSystemOp({
        kind: 'qa',
        tabId: req.tabId,
        elementId: req.elementId,
        notes: result.notes,
        rev: result.rev,
      });
    }
    return result;
  });
  const result = await step;
  return result.ok
    ? Response.json({ notes: result.notes, rev: result.rev })
    : Response.json({ error: 'qa_write_failed' }, { status: result.status });
}

// One live poll answer (docs/specs/012-collaboration/vote-integrity.md). The poll decides the key from what the
// room holds about this session, and the room relays only an accepted answer, as the poll rewrote it.
export async function relayPollAnswer(
  room: DocumentRoom,
  ws: WebSocket,
  op: unknown,
): Promise<void> {
  const session = room.readSession(ws);
  const sender = session?.presence;
  if (!session || !sender) return;
  const outcome = await room.poll.noteAnswer(op, {
    presenceId: sender.id,
    personTag: session.personTag ?? null,
    networkTag: session.networkTag ?? null,
    collabKey: session.collabKey ?? null,
    answeredAs: () => room.readSession(ws)?.pollAnsweredAs ?? null,
    rememberAnswer: (answeredAs) => {
      const latest = room.readSession(ws);
      if (latest) ws.serializeAttachment({ ...latest, pollAnsweredAs: answeredAs });
    },
  });
  if (!outcome.accepted) {
    // A stale or malformed answer is routine; a refusal is the interesting one. Never the key or the proof.
    if (outcome.reason !== 'no_poll' && outcome.reason !== 'bad_value') {
      console.warn('[live-poll] answer refused', { reason: outcome.reason });
    }
    return;
  }
  room.broadcast({ kind: 'op', from: sender.id, op: outcome.op }, ws);
}

// Poll Ended (docs/specs/013-workspace/automations.md "Triggers of its own"): a facilitator's poll-end the room is
// about to act on, for the rules that hear it. The tally is the room's own (room-live-poll.ts), read before the poll
// is let go; whoever ended it is named as the room knows them, by the name on their cursor, never by an account.
// Nothing is read or built unless a rule hears it.
export function notePollEnded(
  room: DocumentRoom,
  op: unknown,
  session: SessionAttachment,
  sender: ParticipantPresence,
): void {
  const env = room.roomEnv;
  const held = room.poll.state;
  if (!env || !held || !hearsEvent(env, POLL_ENDED_EVENT)) return;
  if (held.poll.id !== (op as { pollId?: unknown } | null)?.pollId) return;
  queueEvent(
    env,
    pollEndedEvent(
      held.poll,
      held.answers,
      {
        by: { id: '', name: sender.name, color: sender.color },
        role: roleOfLevel(session.verifiedRole),
      },
      Date.now(),
    ),
  );
}
