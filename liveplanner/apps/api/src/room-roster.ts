// The presence roster each socket is sent (docs/specs/015-api/api.md, Realtime model).
//
// Each client gets the roster MINUS its own entry. The broadcast presence
// id is a fresh server-random per session (docs/specs/015-api/public-api-and-tokens.md §6), so a client can't
// recognise its own entry by id to filter it out — including it makes the
// user show up as a participant twice (once from this list, once from the
// local self entry the editor always renders). The room is the only place
// that knows which presence belongs to which socket, so it excludes it here.
// Presence comes off each socket's attachment (deserialized once per
// socket, then reused for every recipient's roster).
import {
  agentRosterFor,
  type AgentPresenceRecord,
  type RosterSession,
} from '@liveworkspace/api-kit/room-agent-presence';
import type { ParticipantPresence } from './types';

/** One connected socket as the roster reads it: its hello'd presence (null before hello). */
export type RosterEntry = {
  ws: WebSocket;
  presence: ParticipantPresence | null;
  personTag: string | null;
  // A signed-in account holds this socket: only it is sent the others' Google pictures.
  account?: boolean;
};

type RosterFrame = {
  ws: WebSocket;
  participants: ParticipantPresence[];
  agents: ReturnType<typeof agentRosterFor>;
};

/** Each entry's roster, one at a time, so a send can follow each before the next is built. */
export function* rosterFrames(
  entries: readonly RosterEntry[],
  agentEntries: readonly AgentPresenceRecord[],
): Generator<RosterFrame> {
  const sessions: RosterSession[] = entries.flatMap(({ presence, personTag }) =>
    presence ? [{ presenceId: presence.id, personTag }] : [],
  );
  for (const { ws, presence: self, personTag, account } of entries) {
    const agents = agentRosterFor(
      self ? { presenceId: self.id, personTag } : null,
      sessions,
      agentEntries,
    );
    const participants: ParticipantPresence[] = [];
    for (const { ws: peer, presence } of entries) {
      if (peer === ws || !presence) continue;
      // A guest or link visitor gets the same roster with every picture taken out, so the URL never reaches them.
      if (account || presence.picture === undefined) participants.push(presence);
      else {
        const { picture: _hidden, ...withoutPicture } = presence;
        participants.push(withoutPicture);
      }
    }
    yield { ws, participants, agents };
  }
}
