// How a room relays its sample streams, the cursors and any a product adds, so a busy room stays affordable (each
// product's docs/specs/015-api/api.md "A busy room bounds its presence fan-out"). Every product's room runs its
// `cursor` ops through here, and a product with streams of its own names their kinds:
//
//   - A cursor goes to everyone; any other sample goes only to the sockets on its tab (or whose tab the room does
//     not know yet).
//   - In a room of more than 10, a socket that takes batches is sent its samples once a step, as one frame holding
//     each sender's latest sample of each kind. Everything else goes at once, as it always did.
//   - A kind with rules of its own hands in a track (livehuddle's walking characters, its apps/api
//     room-avatar-track.ts): the track says who each sample reaches and in which frame, what a session that just
//     switched tab is shown, and what to forget when a socket closes. Batching stays the relay's.
//
// The Durable Object owns the sockets; this owns the rules, through the small host below, so every product's room
// shares one tested copy.
import {
  presenceBatches,
  presenceStepMs,
  type PresenceBatchMessage,
} from '@liveworkspace/api-schema/presence-fanout';

// The op kinds this relays when a room names none of its own: the cursor, every room's sample stream.
export const RELAYED_SAMPLE_KINDS: ReadonlySet<string> = new Set(['cursor']);

// What the relay needs to know of a session: the tab it is on, the other pane of a split, and whether its editor
// takes batched frames (its `hello` said `batches: true`). Null before its `hello`. A product's track may read more.
export type RelaySession = {
  tabId?: string;
  besideTabId?: string;
  batches?: boolean;
};

// One relayed op frame, as the room sends it.
export type RelayedOp = { kind: 'op'; from: string; op: unknown };

// A frame and its JSON, built once.
export type RelayFrame = { payload: RelayedOp; serialized: string };

// What the relay reads of a sample op.
export type SampleOp = { kind?: unknown; tabId?: unknown };

// How one sample goes out: whether a socket on `session` is sent it, and the frame it is sent.
export type SampleRoute<Sess> = {
  reaches: (session: Sess | null) => boolean;
  frameFor: (session: Sess | null) => RelayFrame;
};

// A product's own rules for one sample kind.
export type SampleTrack<Sess> = {
  // Called once per relayed op of the kind, before it fans out, with its frame as it came.
  route: (from: string, op: SampleOp, frame: RelayFrame) => SampleRoute<Sess>;
  // What a session that just switched tab is shown, other than its own (`selfId`).
  catchUp: (selfId: string, session: Sess | null) => Iterable<RelayFrame>;
  // A socket closed: forget what is kept for its presence.
  forget: (presenceId: string) => void;
};

export type PresenceRelayHost<S, Sess extends RelaySession = RelaySession> = {
  // The room's connected sockets.
  sockets: () => readonly S[];
  // A socket's session, read from its attachment; asked once per socket, then kept until `noteSession` says it
  // changed.
  sessionOf: (socket: S) => Sess | null;
  // The frame `socket` should receive for `payload` (redacted or withheld, null, for a tab-scoped session).
  frameFor: (socket: S, payload: RelayedOp, serialized: string) => string | null;
  // Send one frame; the host sheds a socket whose send throws.
  send: (socket: S, frame: string) => void;
  // Run `fn` after `ms` (the room's setTimeout).
  schedule: (fn: () => void, ms: number) => void;
  // The op kinds relayed as samples, when a product has more than the cursor (livehuddle's `avatar-voice`, its
  // proximity audio's talking level): each goes to its `tabId`'s sockets only and is coalesced like the rest.
  // Unset, RELAYED_SAMPLE_KINDS. A track's kind is relayed whether or not it is named here.
  sampleKinds?: ReadonlySet<string>;
  // The kinds with rules of their own, by kind.
  tracks?: Readonly<Record<string, SampleTrack<Sess>>>;
};

/** Whether a socket on `session` should be sent a sample for `tabId`: its tab, its split's other pane, or a tab the
 *  room does not know yet; a sample with no tab goes to everyone. */
export function tabReaches(tabId: unknown, session: RelaySession | null): boolean {
  if (typeof tabId !== 'string') return true;
  if (!session?.tabId) return true;
  return session.tabId === tabId || session.besideTabId === tabId;
}

/** One frame holding `frames`: the lone frame itself, or a batch of them. */
export function batchFrame(frames: readonly string[]): string {
  if (frames.length === 1) return frames[0]!;
  // Each frame is already JSON, so the batch is spliced rather than parsed and serialised again.
  const head: Omit<PresenceBatchMessage<never>, 'frames'> = { kind: 'batch' };
  return `${JSON.stringify(head).slice(0, -1)},"frames":[${frames.join(',')}]}`;
}

export class PresenceRelay<S extends object, Sess extends RelaySession = RelaySession> {
  private readonly sessions = new WeakMap<S, Sess | null>();
  // Per socket, the frames held for the next flush, keyed by `<kind>:<sender>` so a newer sample replaces an older.
  private readonly held = new Map<S, Map<string, string>>();
  private flushDue = false;

  private readonly host: PresenceRelayHost<S, Sess>;
  private readonly sampleKinds: ReadonlySet<string>;
  private readonly tracks: ReadonlyMap<string, SampleTrack<Sess>>;

  constructor(host: PresenceRelayHost<S, Sess>) {
    this.host = host;
    this.tracks = new Map(Object.entries(host.tracks ?? {}));
    this.sampleKinds = new Set([
      ...(host.sampleKinds ?? RELAYED_SAMPLE_KINDS),
      ...this.tracks.keys(),
    ]);
  }

  private sessionOf(socket: S): Sess | null {
    if (this.sessions.has(socket)) return this.sessions.get(socket)!;
    const session = this.host.sessionOf(socket);
    this.sessions.set(socket, session);
    return session;
  }

  /** A socket said hello or switched tab: what the relay knows of it changed. */
  noteSession(socket: S, session: Sess | null): void {
    this.sessions.set(socket, session);
  }

  /**
   * Relay one sample op from `sender` (presence id `from`) to everyone else. Returns false, sending nothing, for a
   * kind it does not relay, which the room then broadcasts as before.
   */
  relay(sender: S, from: string, op: unknown): boolean {
    const kind = (op as SampleOp | null)?.kind;
    if (typeof kind !== 'string' || !this.sampleKinds.has(kind)) return false;
    const payload: RelayedOp = { kind: 'op', from, op };
    const frame: RelayFrame = { payload, serialized: JSON.stringify(payload) };
    const route = this.tracks.get(kind)?.route(from, op as SampleOp, frame);
    // A cursor goes to everyone; any other kind without a track is its tab's alone.
    const tabId = kind === 'cursor' ? undefined : (op as SampleOp).tabId;
    const sockets = this.host.sockets();
    const batching = presenceBatches(sockets.length);
    const key = `${kind}:${from}`;
    for (const socket of sockets) {
      if (socket === sender) continue;
      const session = this.sessionOf(socket);
      if (route ? !route.reaches(session) : !tabReaches(tabId, session)) continue;
      const out = route ? route.frameFor(session) : frame;
      const sent = this.host.frameFor(socket, out.payload, out.serialized);
      if (sent === null) continue;
      if (batching && session?.batches) this.hold(socket, key, sent, sockets.length);
      else this.host.send(socket, sent);
    }
    return true;
  }

  private hold(socket: S, key: string, frame: string, connections: number): void {
    let frames = this.held.get(socket);
    if (!frames) {
      frames = new Map();
      this.held.set(socket, frames);
    }
    frames.set(key, frame);
    if (this.flushDue) return;
    this.flushDue = true;
    this.host.schedule(() => this.flush(), presenceStepMs(connections));
  }

  /** Send every socket what is held for it, one frame each. */
  flush(): void {
    this.flushDue = false;
    const held = [...this.held];
    this.held.clear();
    for (const [socket, frames] of held) this.host.send(socket, batchFrame([...frames.values()]));
  }

  /** Show a socket that just switched tab what each track keeps for its tab, other than itself (`selfId`). */
  catchUp(socket: S, selfId: string): void {
    const session = this.sessionOf(socket);
    for (const track of this.tracks.values()) {
      for (const out of track.catchUp(selfId, session)) {
        const frame = this.host.frameFor(socket, out.payload, out.serialized);
        if (frame !== null) this.host.send(socket, frame);
      }
    }
  }

  /** A socket closed: drop what is held for it, and what each track keeps for its presence. */
  forget(socket: S, presenceId: string | undefined): void {
    this.held.delete(socket);
    this.sessions.delete(socket);
    if (!presenceId) return;
    for (const track of this.tracks.values()) track.forget(presenceId);
  }
}
