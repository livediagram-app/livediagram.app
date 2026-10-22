// A Participant's writes in the room (docs/specs/013-workspace/share-roles.md "Integrity"; blueprint "Behaviour
// and state"). Split out of project-room.ts, which owns the sockets and hands this module what it needs.
//
// Content: a Participant's `el` op is never relayed as sent. It joins the room's tab write queue, is applied to
// the stored tab by the participant content rule, and only what the rule produced reaches anyone:
//   - applied: an add or a remove as sent, an update as a patch of the fields it changed (never the stored copy
//     whole, which may be behind an Editor's live change), sequenced from the sender to everyone else, and a cursor
//     frame to the sender, as an Editor's op is; an add the rule stamped goes to everyone, the sender included (SR3);
//   - applied with nothing to change: nothing;
//   - refused: the correction to the sender alone; an element not saved yet, or no write at all (a failure, a
//     flood past PARTICIPANT_PENDING_MAX), and the sender re-hydrates (`catchup { resync: true }`).
//
// Answers: a Participant's dot or response relays and enters the ledger like an Editor's, and the room
// writes the ledger's answers into the stored tab ANSWERS_FLUSH_MS later, one write per tab for a burst.

import { isRoomOpRef, type ServerMessage } from '@liveplanner/api-schema';
import type { ElementOp, TabLedger } from '@liveplanner/project';
import {
  writeParticipantAnswers,
  writeParticipantOp,
  type ParticipantWriteResult,
} from './participant-write';
import type { Env } from './types';

// How soon a Participant's answers reach D1 (blueprint SR9).
export const ANSWERS_FLUSH_MS = 1500;
// How many of one socket's writes may wait on the queue (blueprint SR12): far above a person's pace (the autosave
// sends one op per changed element every 600 ms), and a crafted flood is refused rather than starving everyone.
export const PARTICIPANT_PENDING_MAX = 64;

type ParticipantRoomHooks = {
  env: Env | undefined;
  // Run one step on the room's tab write queue, after every step before it.
  enqueue: <T>(step: () => Promise<T>) => Promise<T>;
  // Sequence one mutation into the ordered stream; answers its seq.
  sequence: (from: string, op: unknown, except?: WebSocket) => number;
  sendTo: (ws: WebSocket, payload: ServerMessage) => void;
  // Where the ordered stream stands.
  position: () => { epoch: string; seq: number };
  readLedger: (tabId: string) => Promise<TabLedger>;
};

type ParticipantSender = {
  ws: WebSocket;
  presenceId: string;
  projectId: string | null;
  adderKey: string | null;
};

type ElFrame = { kind: 'el'; tabId: string; op: ElementOp };

function isElFrame(op: unknown): op is ElFrame {
  if (typeof op !== 'object' || op === null) return false;
  const frame = op as { kind?: unknown; tabId?: unknown; op?: unknown };
  if (frame.kind !== 'el' || typeof frame.tabId !== 'string') return false;
  const inner = frame.op as { kind?: unknown } | null;
  return typeof inner === 'object' && inner !== null && typeof inner.kind === 'string';
}

function sameOp(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class RoomParticipantWrites {
  private flushes = new Map<string, { projectId: string; timer: ReturnType<typeof setTimeout> }>();

  private readonly hooks: ParticipantRoomHooks;

  constructor(hooks: ParticipantRoomHooks) {
    this.hooks = hooks;
  }

  // Writes waiting on the queue, per socket: a flood is refused, not queued without end.
  private pending = new WeakMap<WebSocket, number>();

  // One `el` frame from a Participant's socket.
  async applyContentOp(sender: ParticipantSender, frame: unknown, ref?: unknown): Promise<void> {
    const env = this.hooks.env;
    if (!isElFrame(frame)) return;
    const { tabId, op } = frame;
    const projectId = sender.projectId;
    // Nothing to write against (an attachment from before the room knew its project): the sender re-hydrates.
    if (!env || !projectId) return this.resync(sender);
    const queued = this.pending.get(sender.ws) ?? 0;
    if (queued >= PARTICIPANT_PENDING_MAX) {
      console.warn('[participant-write] flood', { projectId, tabId, queued });
      return this.resync(sender);
    }
    this.pending.set(sender.ws, queued + 1);
    let result: ParticipantWriteResult;
    try {
      result = await this.hooks.enqueue(() =>
        writeParticipantOp(env, { projectId, tabId, op, adderKey: sender.adderKey }),
      );
    } catch (error) {
      console.error('[participant-write] failed', { projectId, tabId, error: String(error) });
      return this.resync(sender);
    } finally {
      this.pending.set(sender.ws, (this.pending.get(sender.ws) ?? 1) - 1);
    }
    if (!result.ok) {
      console.error('[participant-write] failed', { projectId, tabId, status: result.status });
      return this.resync(sender);
    }
    const outcome = result.outcome;
    if (outcome.result === 'refused') {
      console.info('[participant-write] refused', { projectId, tabId, reason: outcome.reason });
      // An element not saved yet (an Editor's, inside its autosave): nothing here to put back, so the sender
      // re-hydrates rather than keep a change nobody else has.
      if (outcome.reason === 'missing') return this.resync(sender);
      if (outcome.correction) {
        this.hooks.sendTo(sender.ws, {
          kind: 'op',
          from: 'system',
          op: { kind: 'el', tabId, op: outcome.correction },
        });
      }
      return;
    }
    if (!outcome.changed) return;
    const wire = { kind: 'el', tabId, op: outcome.op };
    if (outcome.op.kind === 'add' && !sameOp(outcome.op, op)) {
      // An add whose adder the rule stamped (an editor bundle that did not): everyone, the sender included,
      // takes the stamped element.
      this.hooks.sequence('system', wire);
      return;
    }
    // As sent (an add, a remove), or the fields it changed (a patch, which the sender already shows): from the
    // sender to everyone else, and its cursor back to it.
    const seq = this.hooks.sequence(sender.presenceId, wire, sender.ws);
    this.hooks.sendTo(sender.ws, {
      kind: 'cursor',
      epoch: this.hooks.position().epoch,
      seq,
      ...(isRoomOpRef(ref) ? { ref } : {}),
    });
  }

  private resync(sender: ParticipantSender): void {
    this.hooks.sendTo(sender.ws, {
      kind: 'catchup',
      ...this.hooks.position(),
      ops: [],
      resync: true,
    });
  }

  // A Participant's dot or response has just entered the ledger: write the tab's answers soon.
  scheduleAnswers(projectId: string | null, tabId: unknown): void {
    if (!projectId || typeof tabId !== 'string' || this.flushes.has(tabId)) return;
    const timer = setTimeout(() => {
      this.flushes.delete(tabId);
      void this.flushAnswers(projectId, tabId);
    }, ANSWERS_FLUSH_MS);
    this.flushes.set(tabId, { projectId, timer });
  }

  async flushAnswers(projectId: string, tabId: string): Promise<void> {
    const env = this.hooks.env;
    if (!env) return;
    try {
      const result = await this.hooks.enqueue(async () =>
        writeParticipantAnswers(env, {
          projectId,
          tabId,
          ledger: await this.hooks.readLedger(tabId),
        }),
      );
      if (result.ok) console.debug('[participant-write] answers', { projectId, tabId, ok: true });
      else
        console.error('[participant-write] failed', { projectId, tabId, status: result.status });
    } catch (error) {
      console.error('[participant-write] failed', { projectId, tabId, error: String(error) });
    }
  }
}
