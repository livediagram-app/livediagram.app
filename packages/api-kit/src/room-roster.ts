// The presence roster every product room sends its sockets (each product's docs/specs/015-api/api.md, Realtime
// model): one `{ kind: 'presence', participants, agents }` frame per socket.
//
// Each client gets the roster MINUS its own entry. The broadcast presence id is a fresh server-random per session
// (docs/specs/015-api/public-api-and-tokens.md §6), so a client can't recognise its own entry by id to filter it out;
// including it makes the user show up as a participant twice (once from this list, once from the local self entry
// the editor always renders). The room is the only place that knows which presence belongs to which socket, so it
// excludes it here.
//
// Google pictures go only to account sessions (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"):
// a guest or an anonymous share-link visitor gets the same roster with every picture removed, so the URL never
// reaches them.
//
// Cost: a join, a leave or a changed hello sends every socket a frame, so a room of N builds N frames of N-1
// entries. Each entry is serialised once (with its picture, and without it), and each socket's frame is those
// strings joined, so the per-broadcast work is the bytes sent rather than N separate JSON.stringify passes over
// N-1 objects. The frame parses to exactly what `JSON.stringify({ kind, participants, agents })` gave before.
import {
  agentRosterFor,
  type AgentPresenceRecord,
  type RosterSession,
} from './room-agent-presence';

/** The fields of a product's participant presence the roster reads. */
export type RosterPresence = { id: string; picture?: string };

/** One connected socket as the roster reads it: its hello'd presence (null before hello). */
export type RosterEntry<P extends RosterPresence = RosterPresence, S = WebSocket> = {
  ws: S;
  presence: P | null;
  personTag: string | null;
  // A verified account holds this socket: only such a recipient is sent others' pictures.
  account?: boolean;
};

/** One socket's serialised presence frame. */
export type RosterFrame<S = WebSocket> = { ws: S; frame: string };

const FRAME_HEAD = '{"kind":"presence","participants":[';
const NO_AGENTS = '[]';

/** Each entry's frame, one at a time, so a send can follow each before the next is built. */
export function* rosterFrames<P extends RosterPresence, S = WebSocket>(
  entries: readonly RosterEntry<P, S>[],
  agentEntries: readonly AgentPresenceRecord[],
): Generator<RosterFrame<S>> {
  // Each hello'd entry serialised once as an account recipient sees it, and once as anyone else does.
  const withPicture: (string | null)[] = [];
  const withoutPicture: (string | null)[] = [];
  for (const { presence } of entries) {
    if (!presence) {
      withPicture.push(null);
      withoutPicture.push(null);
      continue;
    }
    const full = JSON.stringify(presence);
    withPicture.push(full);
    if (presence.picture === undefined) withoutPicture.push(full);
    else {
      const { picture: _hidden, ...rest } = presence;
      withoutPicture.push(JSON.stringify(rest));
    }
  }
  const sessions: RosterSession[] =
    agentEntries.length === 0
      ? []
      : entries.flatMap(({ presence, personTag }) =>
          presence ? [{ presenceId: presence.id, personTag }] : [],
        );
  // The agents array differs between recipients only for a recipient whose person set an agent (its `self`, and
  // its own session left out of `joins`); everyone else is sent one shared array, serialised once.
  const agentPeople = new Set(agentEntries.map((e) => e.personTag));
  let sharedAgents: string | undefined;
  const agentsFor = (self: P | null, personTag: string | null): string => {
    if (agentEntries.length === 0) return NO_AGENTS;
    if (self && personTag !== null && agentPeople.has(personTag))
      return JSON.stringify(
        agentRosterFor({ presenceId: self.id, personTag }, sessions, agentEntries),
      );
    return (sharedAgents ??= JSON.stringify(agentRosterFor(null, sessions, agentEntries)));
  };
  const parts: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const { ws, presence: self, personTag, account } = entries[i]!;
    const seen = account ? withPicture : withoutPicture;
    parts.length = 0;
    for (let j = 0; j < seen.length; j++) {
      const part = seen[j];
      if (j !== i && part) parts.push(part);
    }
    yield {
      ws,
      frame: `${FRAME_HEAD}${parts.join(',')}],"agents":${agentsFor(self, personTag)}}`,
    };
  }
}

/**
 * Whether a hello changes what the roster shows of this session: true for its first hello, and for one whose
 * presence differs by value from the one it already holds. A repeat hello that changes nothing sends nobody a new
 * roster, so one socket cannot make the room rebuild every socket's roster at the frame-rate cap. Presence is flat
 * (strings and an optional role), and an absent field and an `undefined` one read the same.
 */
export function helloChangesRoster<P extends RosterPresence>(
  previous: P | null | undefined,
  next: P,
): boolean {
  if (!previous) return true;
  const a = previous as Record<string, unknown>;
  const b = next as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (!Object.is(a[key], b[key])) return true;
  return false;
}
