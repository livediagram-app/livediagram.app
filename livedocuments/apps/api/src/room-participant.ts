// A Participant's writes in the room (docs/specs/013-workspace/share-roles.md "Integrity"; blueprint "Behaviour
// and state"). Split out of document-room.ts, which owns the sockets and hands this module what it needs.
//
// A Participant edits text only. Its `el` op and its `article` frame are never relayed as sent. Each joins the
// room's tab write queue, is applied to the stored tab by the participant rules, and only what the rule produced
// reaches anyone:
//   - applied: an element update as a patch of the text fields it changed (never the stored copy whole, which may
//     be behind an Editor's live change), an article frame as the writing ops it carried, sequenced from the sender
//     to everyone else, and a cursor frame to the sender, as an Editor's op is;
//   - applied with nothing to change: nothing;
//   - refused: for an element op, the correction to the sender alone; for an article frame, an element not saved
//     yet, or no write at all (a failure, a flood past PARTICIPANT_PENDING_MAX), the sender re-hydrates
//     (`catchup { resync: true }`).

import { isRoomOpRef, type ServerMessage } from '@livedocuments/api-schema';
import {
  isArticleId,
  parseArticleOps,
  type ArticleOp,
  type ElementOp,
} from '@livedocuments/document';
import {
  writeParticipantArticle,
  writeParticipantOp,
  type ParticipantWriteFailure,
} from './participant-write';
import type { Env } from './types';

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
};

type ParticipantSender = {
  ws: WebSocket;
  presenceId: string;
  documentId: string | null;
};

type ElFrame = { kind: 'el'; tabId: string; op: ElementOp };

function isElFrame(op: unknown): op is ElFrame {
  if (typeof op !== 'object' || op === null) return false;
  const frame = op as { kind?: unknown; tabId?: unknown; op?: unknown };
  if (frame.kind !== 'el' || typeof frame.tabId !== 'string') return false;
  const inner = frame.op as { kind?: unknown } | null;
  return typeof inner === 'object' && inner !== null && typeof inner.kind === 'string';
}

type ArticleFrame = { tabId: string; flow: string; ops: ArticleOp[] };

// A writing frame, read defensively: an article named, its ops parsed as a receiver parses them. A frame that
// removes or creates an article is never writing.
function articleFrameOf(op: unknown): ArticleFrame | null {
  if (typeof op !== 'object' || op === null) return null;
  const frame = op as { kind?: unknown; tabId?: unknown; flow?: unknown; ops?: unknown };
  if (frame.kind !== 'article' || typeof frame.tabId !== 'string' || !isArticleId(frame.flow))
    return null;
  if ('removed' in frame || 'created' in frame) return null;
  const ops = parseArticleOps(frame.ops);
  return ops ? { tabId: frame.tabId, flow: frame.flow, ops } : null;
}

export class RoomParticipantWrites {
  private readonly hooks: ParticipantRoomHooks;

  constructor(hooks: ParticipantRoomHooks) {
    this.hooks = hooks;
  }

  // Writes waiting on the queue, per socket: a flood is refused, not queued without end.
  private pending = new WeakMap<WebSocket, number>();

  // One `el` frame from a Participant's socket.
  async applyContentOp(sender: ParticipantSender, frame: unknown, ref?: unknown): Promise<void> {
    if (!isElFrame(frame)) return;
    const { tabId, op } = frame;
    const result = await this.queued(sender, tabId, (env, documentId) =>
      writeParticipantOp(env, { documentId, tabId, op }),
    );
    if (!result) return;
    const outcome = result.outcome;
    if (outcome.result === 'refused') {
      console.info('[participant-write] refused', { tabId, reason: outcome.reason });
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
    this.relay(sender, { kind: 'el', tabId, op: outcome.op }, ref);
  }

  // One `article` frame from a Participant's socket: its writing in an article already on the tab.
  async applyArticleOp(sender: ParticipantSender, frame: unknown, ref?: unknown): Promise<void> {
    const article = articleFrameOf(frame);
    if (!article) return;
    const { tabId, flow, ops } = article;
    const result = await this.queued(sender, tabId, (env, documentId) =>
      writeParticipantArticle(env, { documentId, tabId, flow, ops }),
    );
    if (!result) return;
    const outcome = result.outcome;
    if (outcome.result === 'refused') {
      // The writing is block by block, so there is no one op that puts the sender back: it re-hydrates.
      console.info('[participant-write] article refused', { tabId, reason: outcome.reason });
      return this.resync(sender);
    }
    if (!outcome.changed) return;
    // `grow`: a Participant never adds the pages its writing needs, so an editor that is not its writer grows them
    // (docs/specs/007-editor/article-pages.md "Collaboration").
    this.relay(sender, { kind: 'article', tabId, flow, ops, grow: true }, ref);
  }

  // One write on the room's tab write queue, bounded per socket. Null when it did not happen: the sender has been
  // told to re-hydrate.
  private async queued<T extends { ok: true } | ParticipantWriteFailure>(
    sender: ParticipantSender,
    tabId: string,
    write: (env: Env, documentId: string) => Promise<T>,
  ): Promise<Extract<T, { ok: true }> | null> {
    const env = this.hooks.env;
    const documentId = sender.documentId;
    // Nothing to write against (an attachment from before the room knew its document): the sender re-hydrates.
    if (!env || !documentId) {
      this.resync(sender);
      return null;
    }
    const queued = this.pending.get(sender.ws) ?? 0;
    if (queued >= PARTICIPANT_PENDING_MAX) {
      console.warn('[participant-write] flood', { documentId, tabId, queued });
      this.resync(sender);
      return null;
    }
    this.pending.set(sender.ws, queued + 1);
    let result: T;
    try {
      result = await this.hooks.enqueue(() => write(env, documentId));
    } catch (error) {
      console.error('[participant-write] failed', { documentId, tabId, error: String(error) });
      this.resync(sender);
      return null;
    } finally {
      this.pending.set(sender.ws, (this.pending.get(sender.ws) ?? 1) - 1);
    }
    if (!result.ok) {
      console.error('[participant-write] failed', {
        documentId,
        tabId,
        status: result.status,
      });
      this.resync(sender);
      return null;
    }
    return result as Extract<T, { ok: true }>;
  }

  // What the rule produced, from the sender to everyone else (the sender already shows it), and its cursor back to it.
  private relay(sender: ParticipantSender, wire: unknown, ref: unknown): void {
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
}
