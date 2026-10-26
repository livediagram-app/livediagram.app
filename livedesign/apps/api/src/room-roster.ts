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

/** One connected socket as the roster reads it: its hello'd presence (null before hello), and whether an account
 *  holds it (only an account session is sent other people's Google pictures, liveworkspace/docs/specs/003-accounts/accounts.md
 *  "Profile pictures"; a guest or link visitor gets the same roster with every picture taken out). */
export type RosterEntry = {
  ws: WebSocket;
  presence: ParticipantPresence | null;
  personTag: string | null;
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
      if (account || presence.picture === undefined) {
        participants.push(presence);
        continue;
      }
      const { picture: _hidden, ...withoutPicture } = presence;
      participants.push(withoutPicture);
    }
    yield { ws, participants, agents };
  }
}
