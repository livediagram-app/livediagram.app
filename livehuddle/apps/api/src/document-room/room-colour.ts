import { recolourOpenVisits } from '../db/tab-attendance';
import { presenceColour } from '../document-room-rules';
import type { SessionAttachment } from '../room-session';
import type { DocumentRoom } from './document-room';

// Presence colours, the room's side (docs/specs/014-identity/auth-and-guest-access.md "Presence colours"). The colour
// is the session's own pick, checked like the hello's; a `presence-colour` frame shows a new one at once, so a colour
// changed in Settings › Profile, or yielded to a peer who already wore it, reaches everyone without a reconnect.

/**
 * A `presence-colour` frame: the session's roster entry and its open Attendance visits take the colour, and the
 * roster goes out. An unsafe or empty colour, the same colour again, or a session with no hello yet changes nothing.
 */
export function recolourSession(
  room: DocumentRoom,
  ws: WebSocket,
  session: SessionAttachment,
  raw: unknown,
): void {
  const color = presenceColour(raw);
  const presence = session.presence;
  if (!color || !presence || presence.color === color) return;
  ws.serializeAttachment({
    ...session,
    presence: { ...presence, color },
  } satisfies SessionAttachment);
  const sql = room.state.storage.sql;
  if (presence.key && sql && room.hasSchema()) {
    try {
      room.ensureSchema();
      recolourOpenVisits(sql, presence.key, color);
    } catch (error) {
      console.warn('[presence-colour] visits not recoloured', { error: String(error) });
    }
  }
  room.broadcastPresence();
}
