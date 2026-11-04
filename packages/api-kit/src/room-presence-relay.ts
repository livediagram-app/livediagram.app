// How a room relays its sample streams, the walking characters and the cursors, so a busy room stays affordable
// (each product's docs/specs/015-api/api.md "A busy room bounds its presence fan-out"). Every product with Avatar
// mode runs its room's `avatar` and `cursor` ops through here:
//
//   - A character goes only to the sockets on its tab (or whose tab the room does not know yet); leaving the mode
//     (`avatar: null`) goes to everyone, so nobody keeps a ghost.
//   - The room remembers each walker's last packet, so a session that switches tab is shown where everyone on it
//     stands now, not where they stood the last time it looked. In memory only: a hibernation forgets it, and the
//     standing heartbeat fills it again.
//   - In a room of more than 10, a socket that takes batches is sent its samples once a step, as one frame holding
//     each sender's latest sample of each kind. Everything else goes at once, as it always did.
//
// The Durable Object owns the sockets; this owns the rules, through the small host below, so both products' rooms
// share one tested copy.
import {
  presenceBatches,
  presenceStepMs,
  type PresenceBatchMessage,
} from '@liveworkspace/api-schema/presence-fanout';

// The op kinds this relays: the two sample streams a room carries at walking pace.
export const RELAYED_SAMPLE_KINDS: ReadonlySet<string> = new Set(['avatar', 'cursor']);

// The most walkers the room remembers at once: a closed socket's walker is forgotten, so this only bounds what a
// missed close could leave behind (twice a full room).
export const REMEMBERED_WALKERS = 200;

// What the relay needs to know of a session: the tab it is on, the other pane of a split, and whether its editor
// takes batched frames (its `hello` said `batches: true`). Null before its `hello`.
export type RelaySession = { tabId?: string; besideTabId?: string; batches?: boolean };

// One relayed op frame, as the room sends it.
export type RelayedOp = { kind: 'op'; from: string; op: unknown };

export type PresenceRelayHost<S> = {
  // The room's connected sockets.
  sockets: () => readonly S[];
  // A socket's session, read from its attachment; asked once per socket, then kept until `noteSession` says it
  // changed.
  sessionOf: (socket: S) => RelaySession | null;
  // The frame `socket` should receive for `payload` (redacted or withheld, null, for a tab-scoped session).
  frameFor: (socket: S, payload: RelayedOp, serialized: string) => string | null;
  // Send one frame; the host sheds a socket whose send throws.
  send: (socket: S, frame: string) => void;
  // Run `fn` after `ms` (the room's setTimeout).
  schedule: (fn: () => void, ms: number) => void;
  // The op kinds relayed as samples, when a product has more than the walking pair (livehuddle's `avatar-voice`,
  // its proximity audio's talking level): each goes to its `tabId`'s sockets only and is coalesced like the rest.
  // Unset, RELAYED_SAMPLE_KINDS.
  sampleKinds?: ReadonlySet<string>;
};

type AvatarOpShape = { kind?: unknown; tabId?: unknown; avatar?: unknown };

/** Whether a socket on `session` should be sent this `avatar` op. */
export function avatarReaches(op: AvatarOpShape, session: RelaySession | null): boolean {
  if (op.avatar === null || typeof op.tabId !== 'string') return true;
  if (!session?.tabId) return true;
  return session.tabId === op.tabId || session.besideTabId === op.tabId;
}

/** One frame holding `frames`: the lone frame itself, or a batch of them. */
export function batchFrame(frames: readonly string[]): string {
  if (frames.length === 1) return frames[0]!;
  // Each frame is already JSON, so the batch is spliced rather than parsed and serialised again.
  const head: Omit<PresenceBatchMessage<never>, 'frames'> = { kind: 'batch' };
  return `${JSON.stringify(head).slice(0, -1)},"frames":[${frames.join(',')}]}`;
}

export class PresenceRelay<S extends object> {
  private readonly sessions = new WeakMap<S, RelaySession | null>();
  // Per socket, the frames held for the next flush, keyed by `<kind>:<sender>` so a newer sample replaces an older.
  private readonly held = new Map<S, Map<string, string>>();
  private flushDue = false;
  // Each walker's last packet: the tab it is on, and the frame as relayed.
  private readonly walkers = new Map<
    string,
    { tabId: string; payload: RelayedOp; serialized: string }
  >();

  private readonly host: PresenceRelayHost<S>;
  private readonly sampleKinds: ReadonlySet<string>;

  constructor(host: PresenceRelayHost<S>) {
    this.host = host;
    this.sampleKinds = host.sampleKinds ?? RELAYED_SAMPLE_KINDS;
  }

  private sessionOf(socket: S): RelaySession | null {
    if (this.sessions.has(socket)) return this.sessions.get(socket)!;
    const session = this.host.sessionOf(socket);
    this.sessions.set(socket, session);
    return session;
  }

  /** A socket said hello or switched tab: what the relay knows of it changed. */
  noteSession(socket: S, session: RelaySession | null): void {
    this.sessions.set(socket, session);
  }

  /**
   * Relay one sample op from `sender` (presence id `from`) to everyone else. Returns false, sending nothing, for a
   * kind it does not relay (the host's `sampleKinds`), which the room then broadcasts as before.
   */
  relay(sender: S, from: string, op: unknown): boolean {
    const kind = (op as AvatarOpShape | null)?.kind;
    if (typeof kind !== 'string' || !this.sampleKinds.has(kind)) return false;
    const payload: RelayedOp = { kind: 'op', from, op };
    const serialized = JSON.stringify(payload);
    const avatar = kind === 'avatar' ? (op as AvatarOpShape) : null;
    if (avatar) this.remember(from, avatar, payload, serialized);
    // Any other sample kind but the cursor is a tab's alone, the way a standing character is.
    const scoped = avatar ?? (kind === 'cursor' ? null : (op as AvatarOpShape));
    const sockets = this.host.sockets();
    const batching = presenceBatches(sockets.length);
    const key = `${kind}:${from}`;
    for (const socket of sockets) {
      if (socket === sender) continue;
      const session = this.sessionOf(socket);
      if (scoped && !avatarReaches(scoped, session)) continue;
      const frame = this.host.frameFor(socket, payload, serialized);
      if (frame === null) continue;
      if (batching && session?.batches) this.hold(socket, key, frame, sockets.length);
      else this.host.send(socket, frame);
    }
    return true;
  }

  private remember(from: string, op: AvatarOpShape, payload: RelayedOp, serialized: string): void {
    this.walkers.delete(from);
    if (op.avatar === null || typeof op.tabId !== 'string') return;
    this.walkers.set(from, { tabId: op.tabId, payload, serialized });
    if (this.walkers.size > REMEMBERED_WALKERS) {
      this.walkers.delete(this.walkers.keys().next().value!);
    }
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

  /** Show a socket that just switched tab every walker on its tab, other than itself (`selfId`). */
  catchUp(socket: S, selfId: string): void {
    const session = this.sessionOf(socket);
    for (const [from, walker] of this.walkers) {
      if (from === selfId) continue;
      if (!avatarReaches({ tabId: walker.tabId, avatar: true }, session)) continue;
      const frame = this.host.frameFor(socket, walker.payload, walker.serialized);
      if (frame !== null) this.host.send(socket, frame);
    }
  }

  /** A socket closed: drop what is held for it, and forget its walker. */
  forget(socket: S, presenceId: string | undefined): void {
    this.held.delete(socket);
    this.sessions.delete(socket);
    if (presenceId) this.walkers.delete(presenceId);
  }
}
