// What a document's room knows about its calls, for the server's checks (docs/specs/012-collaboration/
// meeting-rooms-and-stage.md "Trust", "Share roles"; video-and-screen-bubbles.md "Share roles"): where each walker last
// said they stand, whose hand is up and who let it speak, whose screen an Editor stopped, and each tab's rooms and
// stages as last saved. It answers the mint route's "may this session hear these tracks" (#483), a let-speak's "may
// the sender let anyone speak" (#495), and keeps a stopped share from new viewers (#469). Memory only: a room that
// restarts learns positions again from the next steps, and allows what it cannot place for ROOM_WAKE_GRACE_MS.
import {
  CALL_SCREEN_TRACK_NAME,
  parseAvatarHand,
  parseAvatarLetSpeak,
  parseCallTrack,
  parseStoredLevel,
} from '@livehuddle/api-schema';
import { callStages, roomZones, type CallLevel, type Element } from '@livehuddle/document';
import {
  hearingVerdict,
  mayLetSpeakNow,
  type HearingVerdict,
  type Letter,
  type HearingWorld,
  type Placed,
  type TabCalls,
} from './call-hearing';

// The longest seat id the room keeps for a walker: an element id's.
const SEAT_ID_MAX = 64;

/** A room that has just started may not know where everyone stands: for this long, an unknown position is allowed. */
export const ROOM_WAKE_GRACE_MS = 60_000;

/**
 * A connected session as the calls read it: its presence, its stamped role, its call's session once proven, and the
 * roster key its hello claimed (the same person across a reconnect).
 */
export type CallSessionHolder = {
  readonly presenceId: string;
  readonly role: unknown;
  readonly callSession?: string | null;
  readonly key?: string | null;
};

export type RoomCallsHost = {
  now: () => number;
  // Every session the room holds.
  sessions: () => Iterable<CallSessionHolder>;
  // A tab's stored revision, with its JSON when that differs from `knownRev`; null when the room holds no such tab.
  readTab: (tabId: string, knownRev: number | null) => { rev: number; data: string | null } | null;
};

/** The room's answer for one track: a hearing verdict, a share an Editor stopped, or a subscriber it cannot name. */
export type HearingAnswer = HearingVerdict | 'stopped' | 'unknown-session';

/** A track asked for: whose session, which track. */
export type HearingAsk = { readonly sessionId: string; readonly trackName: string };

const NO_CALLS: TabCalls = { zones: [], stages: [] };

/** A stored tab's rooms and stages; none for a tab that does not parse. */
export function tabCallsOf(data: string): TabCalls {
  let tab: { elements?: unknown };
  try {
    tab = JSON.parse(data) as typeof tab;
  } catch {
    return NO_CALLS;
  }
  if (typeof tab !== 'object' || tab === null || !Array.isArray(tab.elements)) return NO_CALLS;
  // No layers (docs/specs/006-document/layers.md): a room saved on a hidden layer counts like any other.
  const elements = tab.elements as Element[];
  const zones = roomZones(elements);
  return { zones, stages: callStages(elements, zones) };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export class RoomCalls {
  private readonly host: RoomCallsHost;
  private readonly startedAt: number;
  private readonly placed = new Map<string, Placed>();
  private readonly raised = new Set<string>();
  private readonly letBy = new Map<string, Letter>();
  // A sharer → the screen they last said they share (its token), and → the one an Editor stopped.
  private readonly screens = new Map<string, string>();
  private readonly stopped = new Map<string, string>();
  private readonly tabs = new Map<string, { rev: number; calls: TabCalls }>();

  constructor(host: RoomCallsHost) {
    this.host = host;
    this.startedAt = host.now();
  }

  /** A walker's `avatar` op: where they stand now, or (avatar null) that they left the mode. */
  noteAvatar(from: string, op: unknown): void {
    const o = op as {
      tabId?: unknown;
      avatar?: { x?: unknown; y?: unknown; seatedOn?: unknown } | null;
    } | null;
    const at = o?.avatar;
    if (typeof o?.tabId !== 'string' || !at || !finite(at.x) || !finite(at.y)) {
      this.placed.delete(from);
      return;
    }
    // The seat too: only its sitter is in a Phone Booth's call (docs/specs/009-elements/workday-pieces.md).
    const seatedOn =
      typeof at.seatedOn === 'string' && at.seatedOn.length <= SEAT_ID_MAX ? at.seatedOn : null;
    this.placed.set(from, { tabId: o.tabId, at: { x: at.x, y: at.y, seatedOn } });
  }

  /** A hand going up or down; down forgets who let it speak. */
  noteHand(from: string, op: unknown): void {
    const hand = parseAvatarHand(op);
    if (!hand) return;
    if (hand.raised) {
      this.raised.add(from);
      return;
    }
    this.raised.delete(from);
    this.letBy.delete(from);
  }

  /** A sharer's `call-track`: once it names no screen, or a new one, a stop an Editor sent is done with. */
  noteTrack(from: string, op: unknown): void {
    const track = parseCallTrack(op);
    if (!track) return;
    if (track.screen) this.screens.set(from, track.screen.token);
    else this.screens.delete(from);
    if (this.stopped.get(from) !== track.screen?.token) this.stopped.delete(from);
  }

  /**
   * Whether `from` may send this let-speak (or Done): an Editor anywhere, or someone the room places on a stage that
   * lets them speak (#495). An allowed one is remembered for the hearing check while the hand stays up, with the
   * sender's roster key, so their reconnect keeps the hand speaking.
   */
  letSpeak(from: string, op: unknown): boolean {
    const parsed = parseAvatarLetSpeak(op);
    const world = this.world();
    if (!parsed || !mayLetSpeakNow(world, from)) return false;
    if (!parsed.on) this.letBy.delete(parsed.targetId);
    else if (this.raised.has(parsed.targetId)) {
      this.letBy.set(parsed.targetId, { id: from, key: world.keys.get(from) ?? null });
    }
    return true;
  }

  /** An Editor stopped `targetId`'s share: no new viewer of that screen until their call says it is off. */
  stopShare(targetId: string): void {
    const screen = this.screens.get(targetId);
    if (screen !== undefined) this.stopped.set(targetId, screen);
  }

  /** A session left: its position, hand and stop go with it. */
  forget(presenceId: string): void {
    this.placed.delete(presenceId);
    this.raised.delete(presenceId);
    this.letBy.delete(presenceId);
    this.screens.delete(presenceId);
    this.stopped.delete(presenceId);
  }

  /** For each track asked for by `subscriberSession`, whether it may be received now. */
  hearing(subscriberSession: string, asks: readonly HearingAsk[]): HearingAnswer[] {
    const bySession = new Map<string, string>();
    for (const s of this.host.sessions()) {
      if (s.callSession) bySession.set(s.callSession, s.presenceId);
    }
    const subscriber = bySession.get(subscriberSession);
    if (subscriber === undefined) return asks.map(() => 'unknown-session');
    const world = this.world();
    return asks.map((ask) => {
      const publisher = bySession.get(ask.sessionId);
      if (publisher === undefined) return world.grace ? 'heard' : 'unplaced';
      if (ask.trackName === CALL_SCREEN_TRACK_NAME && this.stopped.has(publisher)) return 'stopped';
      return hearingVerdict(world, subscriber, publisher);
    });
  }

  private world(): HearingWorld {
    const levels = new Map<string, CallLevel>();
    const keys = new Map<string, string>();
    for (const s of this.host.sessions()) {
      levels.set(s.presenceId, parseStoredLevel(s.role));
      if (s.key) keys.set(s.presenceId, s.key);
    }
    // One read of a tab per answer, however many tracks ask about it.
    const read = new Map<string, TabCalls>();
    return {
      placed: this.placed,
      levels,
      letBy: this.letBy,
      keys,
      tab: (tabId) => {
        let calls = read.get(tabId);
        if (!calls) {
          calls = this.tabCalls(tabId);
          read.set(tabId, calls);
        }
        return calls;
      },
      grace: this.host.now() - this.startedAt < ROOM_WAKE_GRACE_MS,
    };
  }

  // A tab's rooms and stages, parsed again only when its stored revision moved.
  private tabCalls(tabId: string): TabCalls {
    const cached = this.tabs.get(tabId);
    const read = this.host.readTab(tabId, cached?.rev ?? null);
    if (!read) {
      this.tabs.delete(tabId);
      return NO_CALLS;
    }
    if (read.data === null) return cached?.calls ?? NO_CALLS;
    const calls = tabCallsOf(read.data);
    this.tabs.set(tabId, { rev: read.rev, calls });
    return calls;
  }
}
