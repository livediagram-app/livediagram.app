import { answerAgentPresence, clearAgentsForOp } from '@liveworkspace/api-kit/room-agent-presence';
import { multiplayerDecision } from '@liveworkspace/api-kit/room-multiplayer';
import { rosterFrames, type RosterEntry } from '@liveworkspace/api-kit/room-roster';
import type { LiveSession } from '../room-selections';
import type { SessionAttachment } from '../room-session';
import { reportServerEvent } from '../server-telemetry';
import { sendFollowers } from './room-message';
import type { DocumentRoom } from './document-room';

// Who is in the room (document-room.ts): its roster, the agents beside it, a session leaving, and the multiplayer
// count. Each function takes the room it acts for.

/** The one connected socket wearing this presence id. */
export function socketByPresence(room: DocumentRoom, presenceId: string): WebSocket | null {
  for (const ws of room.state.getWebSockets()) {
    if (room.readSession(ws)?.presence?.id === presenceId) return ws;
  }
  return null;
}

// Internal: an agent presence write from the worker (room-agent-presence.ts). Same trust argument as /broadcast.
export async function handleAgentPresence(
  room: DocumentRoom,
  request: Request,
  url: URL,
): Promise<Response> {
  const res = await answerAgentPresence(room.agents, request, url, () => room.broadcastPresence());
  room.armAlarm();
  return res;
}

// A trashed document or a changed link clears agent entries (room-agent-presence.ts, PR15).
export async function clearAgentsFor(room: DocumentRoom, op: unknown): Promise<void> {
  await clearAgentsForOp(room.agents, op, () => room.broadcastPresence(), 'document-trashed');
  room.armAlarm();
}

export function dropSession(room: DocumentRoom, ws: WebSocket): void {
  room.opRates.delete(ws);
  const leaving = room.readSession(ws);
  // A follower leaving is one fewer for the person they followed.
  if (leaving?.following) sendFollowers(room, leaving.following, ws);
  const presenceId = leaving?.presence?.id;
  room.presenceRelay.forget(ws, presenceId);
  if (presenceId) {
    room.baton.startGrace(presenceId);
    void room.selections.drop(presenceId).catch(() => {});
  }
  // Exclude the departing socket explicitly: depending on when the
  // runtime prunes it from getWebSockets(), it could otherwise still
  // appear in the roster of this very broadcast.
  room.broadcastPresence(ws);
}

// The person tags of the hello'd sessions: who is looking at the canvas now, whom a phone notification skips
// (docs/specs/014-identity/phone-notifications.md).
export function roomPeople(room: DocumentRoom): Set<string> {
  const tags = new Set<string>();
  for (const session of liveSessions(room).values())
    if (session.personTag) tags.add(session.personTag);
  return tags;
}

// Every hello'd session with a live socket, by presence id: what the selection store answers
// against, so an entry whose socket is gone never holds anything.
export function liveSessions(room: DocumentRoom): Map<string, LiveSession> {
  const live = new Map<string, LiveSession>();
  for (const ws of room.state.getWebSockets()) {
    const session = room.readSession(ws);
    const p = session?.presence;
    if (!p) continue;
    live.set(p.id, { name: p.name, color: p.color, personTag: session.personTag ?? null });
  }
  return live;
}

// Count the room's multiplayer session once, from the one place that sees
// every participant (docs/specs/017-telemetry/telemetry.md). Runs after each hello, the only moment the
// hello'd roster can grow; the decision and its session rule live in
// room-multiplayer.ts.
export function noteMultiplayer(room: DocumentRoom): void {
  const sockets = room.state.getWebSockets();
  const sessions = sockets.map((ws) => room.readSession(ws));
  const decision = multiplayerDecision(
    sessions.map((s) => ({ present: Boolean(s?.presence), multiplayer: s?.multiplayer })),
  );
  for (const i of decision.mark) {
    const session = sessions[i];
    if (!session) continue;
    try {
      sockets[i]!.serializeAttachment({
        ...session,
        multiplayer: true,
      } satisfies SessionAttachment);
    } catch {
      // A socket that died mid-loop: the runtime reaps it, nothing to mark.
    }
  }
  const env = room.roomEnv;
  if (decision.report && env) {
    const write = reportServerEvent(env, 'Document', 'Used', 'Multiplayer');
    // Keep the DO alive until the row lands; the write swallows its own error.
    room.state.waitUntil(write);
  }
}

// Send each client the roster minus its own entry (@liveworkspace/api-kit/room-roster): the
// `{ kind: 'presence', participants, agents }` ServerMessage, serialised there.
export function broadcastPresence(room: DocumentRoom, except?: WebSocket): void {
  const entries: RosterEntry[] = [];
  for (const ws of room.state.getWebSockets()) {
    if (ws === except) continue;
    const session = room.readSession(ws);
    entries.push({
      ws,
      presence: session?.presence ?? null,
      personTag: session?.personTag ?? null,
      account: session?.account === true,
    });
  }
  // Agent entries past their expiry never reach a frame; the store drops them on its next sweep (PR30).
  const now = Date.now();
  const agentEntries = room.agents.live().filter((r) => r.expiresAt > now);
  if (agentEntries.length < room.agents.live().length)
    void room.agents.sweep().then(() => room.armAlarm());
  for (const { ws, frame } of rosterFrames(entries, agentEntries)) {
    try {
      ws.send(frame);
    } catch {
      // Dead socket: the runtime reaps it from getWebSockets(); we only
      // shed the in-memory rate entry so the map can't leak.
      room.opRates.delete(ws);
    }
  }
}
