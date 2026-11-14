import { renameOpenVisits } from '../db/tab-attendance';
import { readVisitorName, writeVisitorName } from '../db/visitor-names';
import { typedPresenceName } from '../document-room-rules';
import type { SessionAttachment } from '../room-session';
import type { DocumentRoom } from './document-room';

// Presence names, the room's side (docs/specs/014-identity/auth-and-guest-access.md "Presence names"; Work Tracker 797
// and 801). The room picks every name and never reads the hello's: a person goes by their profile's name, which the
// api stamps on the upgrade and relays again when they rename themselves (`/presence-name`); a session with no
// identity by the name its browser typed (`visitor-name`), kept here under its collab key so a reload keeps it.

/** A session with no identity: no person behind it, so no profile and no person tag. */
function hasNoIdentity(session: SessionAttachment): boolean {
  return !session.personTag;
}

/**
 * The name the room keeps for this session's browser, when it has no identity and the document holds one for its key.
 * Never throws: a store failure reads as no name, and the session takes its guest name.
 */
export function storedVisitorName(room: DocumentRoom, session: SessionAttachment): string | null {
  const key = session.collabKey;
  const sql = room.state.storage.sql;
  if (!hasNoIdentity(session) || !key || !sql || !room.hasSchema()) return null;
  try {
    room.ensureSchema();
    return readVisitorName(sql, key);
  } catch (error) {
    console.warn('[presence-name] visitor name not read', { error: String(error) });
    return null;
  }
}

// Show `name` for one session, with any other fields it now carries. Whether its roster entry changed.
function renameSession(
  ws: WebSocket,
  session: SessionAttachment,
  name: string,
  fields: Partial<SessionAttachment>,
): boolean {
  const presence = session.presence;
  ws.serializeAttachment({
    ...session,
    ...fields,
    ...(presence ? { presence: { ...presence, name } } : {}),
  } satisfies SessionAttachment);
  return !!presence && presence.name !== name;
}

// The renamed person's open visits show the new name: Attendance reads the name the room last gave them.
function renameVisits(room: DocumentRoom, key: string | undefined, name: string): void {
  const sql = room.state.storage.sql;
  if (!key || !sql || !room.hasSchema()) return;
  try {
    room.ensureSchema();
    renameOpenVisits(sql, key, name);
  } catch (error) {
    console.warn('[presence-name] visits not renamed', { error: String(error) });
  }
}

/**
 * A `visitor-name` frame: a session with no identity names itself. Kept under its browser's collab key (a reload
 * keeps it) and shown at once. Refused from a session with an identity (their name is their profile's) and from one
 * that has said no hello yet; a blank name changes nothing.
 */
export function nameVisitor(
  room: DocumentRoom,
  ws: WebSocket,
  session: SessionAttachment,
  raw: unknown,
  now = Date.now(),
): void {
  const name = typedPresenceName(raw);
  const key = session.presence?.key;
  // The same name again writes and sends nothing.
  if (!name || !key || !hasNoIdentity(session) || session.presence?.name === name) return;
  const sql = room.state.storage.sql;
  if (sql && room.hasSchema()) {
    try {
      room.ensureSchema();
      writeVisitorName(sql, key, name, now);
    } catch (error) {
      console.warn('[presence-name] visitor name not kept', { error: String(error) });
    }
  }
  if (!renameSession(ws, session, name, {})) return;
  renameVisits(room, key, name);
  room.broadcastPresence();
}

/**
 * The api relayed a person's new profile name (`/presence-name`): every session of theirs in this room, found by
 * their per-document person tag, goes by it, and the roster goes out once. Returns how many sessions it renamed.
 */
export function renamePerson(room: DocumentRoom, personTag: string, raw: unknown): number {
  const name = typedPresenceName(raw);
  if (!name || !personTag) return 0;
  let renamed = 0;
  let changed = false;
  const keys = new Set<string>();
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    if (!session || session.personTag !== personTag) continue;
    try {
      if (renameSession(ws, session, name, { verifiedName: name })) changed = true;
    } catch {
      // The socket is going; its close tells the roster.
      continue;
    }
    renamed++;
    if (session.presence?.key) keys.add(session.presence.key);
  }
  for (const key of keys) renameVisits(room, key, name);
  if (changed) room.broadcastPresence();
  return renamed;
}
