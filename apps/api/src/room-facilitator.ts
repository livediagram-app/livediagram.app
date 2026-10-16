// The facilitator baton in the room (docs/specs/012-collaboration/facilitator.md): who is running the session, kept
// in storage, moved only by the rules in facilitator.ts, and announced so that exactly one socket ever sees the token.
import {
  beginGrace,
  claimBaton,
  FREE_BATON,
  graceExpired,
  grantBaton,
  mayReleaseLock,
  mayRunSession,
  reclaimBaton,
  releaseBaton,
  type Asker,
  type BatonMove,
  type FacilitatorState,
} from './facilitator';
import type { SessionAttachment } from './room-session';
import type { ClientMessage, ServerMessage } from './types';

// The facilitator baton's storage key. In storage rather than memory so it
// survives a hibernation cycle: the holder's refresh must find the same token
// waiting for it, and a room that forgot the baton every time it went to sleep
// would drop the role mid-session for no reason the user could see.
const FACILITATOR_KEY = 'facilitator';

type Announce = { reason: 'claim' | 'grant' | 'release' | 'left' | 'state'; by?: string };

/** What the baton needs from the room around it. */
export type RoomFacilitatorDeps = {
  storage: DurableObjectStorage;
  broadcast: (payload: ServerMessage, except?: WebSocket) => void;
  sendTo: (ws: WebSocket, payload: ServerMessage) => void;
  sendToPresence: (presenceId: string, payload: ServerMessage) => void;
  /** The one connected socket wearing this presence id. */
  socketByPresence: (presenceId: string) => WebSocket | null;
  readSession: (ws: WebSocket) => SessionAttachment | null;
  /** Re-arm the room's one alarm after the grace deadline moved. */
  armAlarm: () => void;
};

/** What the baton rules need to know about one session. */
export function askerOf(session: SessionAttachment): Asker {
  return {
    presenceId: session.presence?.id ?? session.presenceId,
    role: session.verifiedRole,
    isOwner: session.isOwner === true,
  };
}

export class RoomFacilitator {
  state: FacilitatorState = FREE_BATON;
  private readonly deps: RoomFacilitatorDeps;

  constructor(deps: RoomFacilitatorDeps) {
    this.deps = deps;
  }

  /** Restore the stored baton; run inside the room's blockConcurrencyWhile. */
  async restore(): Promise<void> {
    this.state = (await this.deps.storage.get<FacilitatorState>(FACILITATOR_KEY)) ?? FREE_BATON;
  }

  /** The grace deadline the room's alarm must ring for, if the baton is held. */
  deadline(): number | undefined {
    return this.state.holder !== null ? this.state.graceUntil : undefined;
  }

  /**
   * A session said hello: give a returning holder their baton back, or catch this one session up on
   * who is running the session.
   */
  welcome(
    ws: WebSocket,
    session: SessionAttachment,
    presenceId: string,
    token: string | undefined,
  ): void {
    // Judge the baton BEFORE honouring a token: one that ran out of time is
    // free, whether or not an alarm happened to fire while the room was
    // awake. Otherwise whether a returning holder got their baton back would
    // depend on how the room had been sleeping, and the room may already have
    // told everybody that nobody is facilitating.
    this.sweepLapsed();
    // The baton coming home from a refresh (docs/specs/012-collaboration/facilitator.md): the token is the
    // proof, because the room has no identities to check it against. It is
    // announced to NOBODY — a refresh is not an event, and the holder's own
    // screen would otherwise report that somebody had made them the
    // facilitator every time they reloaded. The frame still goes out, since
    // their presence id is new and everybody's badge has to follow it.
    const reclaimed = reclaimBaton(this.state, askerOf(session), token);
    if (reclaimed) {
      this.set(reclaimed, { reason: 'state' });
      return;
    }
    // Otherwise catch this one session up on who is running the session.
    // `state` announces nothing: nothing happened, they merely arrived.
    //
    // The token rides along when this session IS the holder. It is how a
    // client knows the baton is its own (it cannot recognise its own
    // presence id), so a tokenless frame to the holder would take their
    // controls away while the room still had them running the session.
    const mine = this.state.holder === presenceId ? this.state.token : null;
    this.deps.sendTo(ws, {
      kind: 'facilitator',
      holder: this.state.holder,
      reason: 'state',
      ...(mine ? { token: mine } : {}),
    });
  }

  /** Whether this presence may start or end a poll now. */
  mayRun(presenceId: string): boolean {
    // Same reason the hello path sweeps: a baton whose holder never came
    // back must not keep refusing polls just because no alarm has fired.
    this.sweepLapsed();
    return mayRunSession(this.state, presenceId);
  }

  /** A client asked to move the baton. The room decides; silence means no. */
  handle(msg: Extract<ClientMessage, { kind: 'facilitator' }>, session: SessionAttachment): void {
    this.sweepLapsed();
    const asker = askerOf(session);
    let move: BatonMove | null = null;
    if (msg.action === 'claim') {
      move = claimBaton(this.state, asker, crypto.randomUUID());
    } else if (msg.action === 'grant') {
      move = grantBaton(this.state, asker, this.sessionByPresence(msg.to), crypto.randomUUID());
    } else if (msg.action === 'release') {
      move = releaseBaton(this.state, asker);
    } else if (msg.action === 'unlock') {
      // Uses the baton rather than moving it, so it returns here instead of
      // falling through to set: there is no BatonMove to make.
      this.releaseSelectionLock(asker, msg.target, msg.elementId);
      return;
    }
    if (!move) return;
    this.set(move.next, { reason: move.reason, by: asker.presenceId });
  }

  /**
   * The holder's socket went away. Start the grace clock rather than ending
   * their turn: a refresh, a closed lid and a dropped connection all look
   * exactly like leaving from here, and only one of them means it.
   */
  startGrace(leaving: string): void {
    const next = beginGrace(this.state, leaving, Date.now());
    if (!next) return;
    this.state = next;
    void this.deps.storage.put(FACILITATOR_KEY, next);
    // The alarm is what turns "away" into "gone" without anybody having to be
    // connected to notice. A reclaim clears the deadline, so a fired alarm
    // whose deadline has moved simply does nothing.
    this.deps.armAlarm();
  }

  /** The alarm rang: the grace clock ran out (or did not, if they came back). */
  alarm(): void {
    if (graceExpired(this.state, Date.now()))
      this.set(FREE_BATON, { reason: 'left', by: this.state.holder ?? undefined });
  }

  /**
   * Land a decided move: persist it, tell the room, and hand the new token to
   * its holder alone.
   *
   * The token goes in a SECOND frame addressed to the holder rather than in the
   * broadcast, because a broadcast token is not a secret and the whole model
   * rests on exactly one socket ever seeing it.
   */
  private set(next: FacilitatorState, announce: Announce): void {
    this.state = next;
    void this.deps.storage.put(FACILITATOR_KEY, next);
    const frame: ServerMessage = {
      kind: 'facilitator',
      holder: next.holder,
      reason: announce.reason,
      ...(announce.by ? { by: announce.by } : {}),
    };
    // Exactly one frame each, and the holder's is the only one with the token.
    // That matters beyond secrecy: a client cannot recognise its own presence
    // id (the room mints it and never says which one is yours), so the token
    // is also how the holder knows the baton is THEIRS. Two frames to the same
    // socket would make them briefly somebody else in their own UI.
    const holderSocket = next.holder ? this.deps.socketByPresence(next.holder) : null;
    this.deps.broadcast(frame, holderSocket ?? undefined);
    if (holderSocket && next.token) {
      this.deps.sendTo(holderSocket, { ...frame, token: next.token });
    }
  }

  /**
   * Release a baton whose grace period ran out while nothing was listening.
   *
   * The alarm does this the moment it fires, but an alarm needs a room: if the
   * DO is evicted before it rings (everybody left, the room went quiet), the
   * stored baton would still name somebody who has not been here for days, and
   * the next session would find its session tools held by a ghost. So the two
   * paths that read the baton sweep it first. Silent on purpose — the frame
   * the caller is about to send reports the truth, and "Alex left" is not news
   * to somebody who never saw Alex.
   */
  private sweepLapsed(): void {
    if (!graceExpired(this.state, Date.now())) return;
    this.state = FREE_BATON;
    void this.deps.storage.put(FACILITATOR_KEY, FREE_BATON);
  }

  /**
   * Tell one peer to let go of an element (docs/specs/007-editor/live-app.md lock, docs/specs/012-collaboration/facilitator.md facilitator).
   *
   * Sent to the holder's socket ALONE, which is the entire addressing scheme:
   * a client is never told its own presence id (docs/specs/015-api/public-api-and-tokens.md §6), so a broadcast
   * naming a target would arrive at nobody who could recognise it. The holder
   * then drops the selection and re-broadcasts its own `select`, which clears
   * the lock everywhere through the path that already exists — so the room
   * announces nothing to anybody else.
   *
   * Silent on every refusal. A caller without the baton, a target who has
   * already left, or somebody asking to unlock themselves all reach the same
   * "nothing to do", and a room that answered them would be telling a peer
   * which presence ids are live.
   */
  private releaseSelectionLock(asker: Asker, target: string, elementId: string): void {
    // A view-role visitor can't select, edit or hold the baton, so it has no
    // business freeing an editor's hold either. The client hides the menu
    // from them; this is the room refusing a hand-sent frame.
    if (asker.role !== 'edit') return;
    if (!mayReleaseLock(this.state, asker.presenceId)) return;
    if (target === asker.presenceId) return;
    if (typeof elementId !== 'string' || elementId.length === 0) return;
    if (!this.deps.socketByPresence(target)) return;
    this.deps.sendToPresence(target, {
      kind: 'selection-released',
      elementId,
      by: asker.presenceId,
    });
  }

  /** The target of a grant, as the rules need it. Null when they have left. */
  private sessionByPresence(presenceId: string): Asker | null {
    const ws = this.deps.socketByPresence(presenceId);
    const attachment = ws ? this.deps.readSession(ws) : null;
    return attachment ? askerOf(attachment) : null;
  }
}
