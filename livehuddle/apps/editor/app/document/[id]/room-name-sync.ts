import type { RoomOutgoing } from '@livehuddle/api-schema';

// Our presence name and the room's (docs/specs/014-identity/auth-and-guest-access.md "Presence names"; Work Tracker
// 797 and 801). The room picks every name and never reads the one our hello sends, so a name chosen here (the join
// dialog, Settings › Profile) reaches peers only by telling the room: a person asks the api, which reads their profile
// fresh (`POST /room-name`), and a link visitor, who has no profile, names itself over the socket (`visitor-name`).
// Until the room shows the chosen name, a roster still carrying the old one is not taken back; after that, the room's
// name for us is ours too, so our own avatar never says something peers do not see.

// How long a chosen name waits for the room to show it before the room's name wins again: far past a door's answer
// (a profile read and a room call), short enough that a lost rename does not leave us showing a name nobody else sees.
export const ROOM_NAME_PENDING_MS = 15_000;

export type RoomNameSync = {
  /** We chose `name`: a roster still showing another is not taken back until the room shows it, or the wait ends. */
  chose: (name: string, now?: number) => void;
  /** The room's name for us arrived: the name to take as our own, or null to keep ours. */
  fromRoster: (roomName: string, localName: string, now?: number) => string | null;
};

export function createRoomNameSync(): RoomNameSync {
  let pending: { name: string; until: number } | null = null;
  return {
    chose(name, now = Date.now()) {
      pending = { name: name.trim(), until: now + ROOM_NAME_PENDING_MS };
    },
    fromRoster(roomName, localName, now = Date.now()) {
      if (pending) {
        if (roomName === pending.name) pending = null;
        else if (now < pending.until) return null;
        else pending = null;
      }
      return roomName && roomName !== localName ? roomName : null;
    },
  };
}

/** What telling the room needs: who we are, where, and how. */
export type RoomNameAnnounce = {
  sync: RoomNameSync;
  name: string;
  // A person (an account, or a guest with a token) has a profile; a link visitor has none.
  hasIdentity: boolean;
  // The profile write landed: a person's door reads it, so a failed one is not announced.
  saved: boolean;
  // The open room, or null with none (a document in This Browser): then there is nobody to tell.
  room: { send: (msg: RoomOutgoing) => void } | null;
  // POST /room-name for the document (lib/api/room-name.ts).
  announce: () => Promise<string | null>;
};

/** Tell the room we chose `name`: through the api for a person, over the socket for a link visitor. */
export async function announceRoomName(a: RoomNameAnnounce): Promise<void> {
  if (!a.room) return;
  if (!a.hasIdentity) {
    a.sync.chose(a.name);
    a.room.send({ kind: 'visitor-name', name: a.name });
    return;
  }
  if (!a.saved) return;
  a.sync.chose(a.name);
  await a.announce();
}
