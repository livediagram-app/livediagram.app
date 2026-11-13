// A session's grant on the room (plan-room.ts): admitting a socket, asking for a fresh grant before the old one
// lapses, closing the lapsed, and taking a renewal. Each takes the room.
import {
  earliestRoomGrantDue,
  openRoomSockets,
  renewRoomGrant,
  roomGrantStep,
} from '@liveworkspace/index-app';
import { indexService } from '../index-service';
import {
  ACCESS_CHANGED_CLOSE,
  GRANT_LAPSED_CLOSE,
  ROOM_GRANT_ASK_BEFORE_MS,
  ROOM_FULL_CLOSE,
  ROOM_FULL_REASON,
  roomIsFull,
  type AccessLevel,
} from '@liveplanner/api-schema';
import { newSessionAttachment, type SessionAttachment } from '../room-session';
import { getTab } from '../db/tabs';
import { tabShowsEveryCard } from '@liveplanner/items';
import type { PlanRoom } from './plan-room';
import { closeSockets, sendTo } from './plan-room-sockets';

// ---------- Grants (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants") ---------------------------------
//
// Every session joined with the index's grant, which lapses after ten minutes. ROOM_GRANT_ASK_BEFORE_MS before
// it does, the room asks the session for a fresh one (`grant-renew`); the session answers with a `grant` frame
// (its editor renews a minute early anyway, and sends each new grant unasked). A session still holding a
// lapsed grant is closed with GRANT_LAPSED_CLOSE, and its editor rejoins with a fresh one, or not at all. The
// decisions are @liveworkspace/index-app's (room-ticket.ts).

export function nextGrantDue(room: PlanRoom): number | null {
  return earliestRoomGrantDue(
    openRoomSockets(room.state.getWebSockets()).map((ws) => room.readSession(ws)),
    ROOM_GRANT_ASK_BEFORE_MS,
  );
}

// Ask the sessions whose grant is about to lapse, and close those whose grant has.
export function checkGrants(room: PlanRoom, now: number): void {
  let lapsed = 0;
  for (const ws of openRoomSockets(room.state.getWebSockets())) {
    const s = room.readSession(ws);
    const step = roomGrantStep(s, now, ROOM_GRANT_ASK_BEFORE_MS);
    if (step === 'lapsed') {
      try {
        ws.close(GRANT_LAPSED_CLOSE, 'grant-lapsed');
      } catch {
        // Already gone.
      }
      room.opRates.delete(ws);
      lapsed++;
    } else if (step === 'ask' && s?.grantExp) {
      sendTo(room, ws, { kind: 'grant-renew', expiresAt: s.grantExp });
      try {
        ws.serializeAttachment({ ...s, renewAsked: true } satisfies SessionAttachment);
      } catch {
        // The socket is going; its lapse closes it.
      }
    }
  }
  if (lapsed > 0) console.info('[grant] sessions lapsed', { closed: lapsed });
}

// A session's fresh grant (the `grant` frame): the same plan, level and tab move its lapse on. One that says
// something else (a level changed, a tab rescoped) ends the session, and the editor rejoins with what it holds
// now. A grant that does not check is ignored; the old one still lapses.
export async function renewGrant(room: PlanRoom, ws: WebSocket, ticket: unknown): Promise<void> {
  const env = room.roomEnv;
  const session = room.readSession(ws);
  if (!env || !session?.projectId) return;
  const renewal = await renewRoomGrant(indexService, env, ticket, session.projectId, {
    level: session.verifiedRole,
    tab: session.tabScope,
    pairing: session.workbenchPairing ?? null,
  });
  if (renewal.kind === 'invalid') {
    console.warn('[grant] renewal refused', { reason: 'invalid' });
    return;
  }
  if (renewal.kind === 'changed') {
    console.info('[grant] renewal changed access', {
      from: session.verifiedRole,
      to: renewal.level,
    });
    closeSockets(room, (each) => (each === ws ? [ACCESS_CHANGED_CLOSE, 'access-changed'] : null));
    return;
  }
  await room.takeHead(renewal.claims);
  await room.takeGrantStanding(renewal.claims);
  const current = room.readSession(ws);
  if (!current) return;
  try {
    ws.serializeAttachment({
      ...current,
      grantExp: renewal.grantExp,
      renewAsked: false,
    } satisfies SessionAttachment);
  } catch {
    return;
  }
  room.armAlarm();
}

// Admit one server-side socket into the room: pin its hibernation-proof
// session state (attachment) and hand it to the runtime. Split out of
// fetch so tests can drive sessions without constructing WebSocketPair.
export function acceptSession(
  room: PlanRoom,
  ws: WebSocket,
  verifiedRole?: AccessLevel,
  tabScope: string | null = null,
  shareCode: string | null = null,
  personTag: string | null = null,
  workbenchPairing: string | null = null,
  adderKey: string | null = null,
  projectId: string | null = null,
  grantExp: number | null = null,
  account = false,
  tabShowsAll = false,
  // The session's collab key (X-Verified-Collab-Key, docs/specs/013-workspace/share-roles.md "The collab key"):
  // none mints one for this socket.
  collabKey: string | null = null,
  // The person stamped on its reactions (X-Verified-Reaction-Person,
  // docs/specs/012-collaboration/comment-reactions.md).
  reactionPerson: string | null = null,
): void {
  // A full room (ROOM_MAX_CONNECTIONS, docs/specs/015-api/api.md "A room holds 100 connections") turns the
  // newcomer away with a close the browser can read: accepted, closed at once, never a session.
  if (roomIsFull(room.state.getWebSockets().length)) {
    ws.accept();
    ws.close(ROOM_FULL_CLOSE, ROOM_FULL_REASON);
    console.info('[room] room.full', { open: room.state.getWebSockets().length });
    return;
  }
  ws.serializeAttachment(
    newSessionAttachment(
      {
        verifiedRole,
        collabKey,
        reactionPerson,
        tabScope,
        shareCode,
        personTag,
        workbenchPairing,
        adderKey,
        projectId,
        grantExp,
        account,
        tabShowsAll,
      },
      crypto.randomUUID(),
    ),
  );
  // Hibernation-aware accept: the runtime owns the socket's event
  // delivery (webSocketMessage / webSocketClose / webSocketError) and
  // may evict this DO between events. NOT ws.accept(), which would pin
  // the DO in memory for the socket's whole life.
  room.state.acceptWebSocket(ws);
}

// Whether the one tab a scoped session is confined to already shows every card (a board or plan view): only then
// may its ops carry one (room-scope.ts, docs/specs/026-plan/items.md "Who may do what"). Read once per scoped
// connection; a tab that can't be read counts as not.
export async function scopedTabShowsAll(
  room: PlanRoom,
  planId: string | null,
  tabScope: string | null,
): Promise<boolean> {
  if (!planId || !tabScope) return false;
  const tab = await getTab(room.requireEnv(), planId, tabScope).catch(() => null);
  return tabShowsEveryCard(tab?.elements ?? []);
}
