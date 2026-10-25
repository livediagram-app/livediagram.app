// The ticket a socket joins an item's room with (`…/ws?t=`), and renews its session with: the index's grant itself
// (liveworkspace/docs/one-explorer-contracts.md "Grants"). A browser can't put headers on a WebSocket upgrade, so it
// goes on the URL; it is short-lived (ten minutes) and names its item.
//
// A workbench session's ticket carries one fact more, its pairing (so unpairing closes exactly its sockets) and its
// level cap, sealed to the grant with the app's key: `<grant>~<pairing>~<cap>~<hmac>`. Nothing else may claim a
// pairing.

import { isLevel, type GrantClaims, type Level } from '@liveworkspace/index-client';
import type { IndexEnv, IndexService } from './service';
import { timingSafeEqual } from './timing-safe';

const SEP = '~';

export type RoomTicketWorkbench = { pairing: string; cap: Level };

export type RoomTicket = {
  claims: GrantClaims;
  grant: string;
  workbench: RoomTicketWorkbench | null;
};

async function hmacHex(key: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sealed(grant: string, pairing: string, cap: Level): string {
  return `room-ticket:v1${SEP}${grant}${SEP}${pairing}${SEP}${cap}`;
}

// The room's ticket for a grant: the grant as it is, or sealed to a workbench session's pairing and cap.
export async function sealRoomTicket(
  env: Pick<IndexEnv, 'INDEX_KEY'>,
  grant: string,
  workbench: RoomTicketWorkbench | null,
): Promise<string> {
  if (!workbench) return grant;
  if (!env.INDEX_KEY) throw new Error('no INDEX_KEY to seal a workbench ticket');
  if (workbench.pairing.includes(SEP)) throw new Error('a pairing id may not hold the separator');
  const mac = await hmacHex(env.INDEX_KEY, sealed(grant, workbench.pairing, workbench.cap));
  return [grant, workbench.pairing, workbench.cap, mac].join(SEP);
}

// The ticket's grant, checked against the index's keys and this item, and its sealed workbench facts. Null for
// anything forged, lapsed or for another item.
export async function openRoomTicket(
  service: Pick<IndexService, 'verifyGrant'>,
  env: IndexEnv,
  ticket: string | null | undefined,
  itemId: string,
): Promise<RoomTicket | null> {
  if (!ticket) return null;
  const parts = ticket.split(SEP);
  let workbench: RoomTicketWorkbench | null = null;
  if (parts.length === 4) {
    const [grant, pairing, cap, mac] = parts as [string, string, string, string];
    if (!env.INDEX_KEY || !isLevel(cap)) return null;
    const expected = await hmacHex(env.INDEX_KEY, sealed(grant, pairing, cap));
    if (!(await timingSafeEqual(expected, mac))) return null;
    workbench = { pairing, cap };
  } else if (parts.length !== 1) {
    return null;
  }
  const grant = parts[0]!;
  const claims = await service.verifyGrant(env, grant, itemId);
  return claims ? { claims, grant, workbench } : null;
}

// ---------- A session's grant in the room ---------------------------------------------------------------------
//
// Every session joins with the index's grant, which lapses after ten minutes. Shortly before it does, the room asks
// the session for a fresh one (`grant-renew`); the session answers with a `grant` frame (its editor renews a minute
// early anyway, and sends each new grant unasked). A session still holding a lapsed grant is closed, and its editor
// rejoins with a fresh one, or not at all. The room keeps `grantExp` (epoch ms) and `renewAsked` on each socket's
// attachment; these are the decisions, the same in every app's room.

export type RoomGrantHold = { grantExp?: number | null; renewAsked?: boolean };

// The level a ticket admits at: the grant's, held to a workbench session's cap.
export function roomTicketLevel(opened: Pick<RoomTicket, 'claims' | 'workbench'>): Level {
  const { level } = opened.claims;
  const cap = opened.workbench?.cap;
  if (!cap) return level;
  const order: Level[] = ['view', 'participate', 'edit'];
  return order[Math.min(order.indexOf(level), order.indexOf(cap))]!;
}

// When a session's grant next needs the room: its ask, or its lapse once asked. Null for a session with no grant.
export function roomGrantDueAt(hold: RoomGrantHold | null, askBeforeMs: number): number | null {
  if (!hold?.grantExp) return null;
  return hold.renewAsked ? hold.grantExp : hold.grantExp - askBeforeMs;
}

// The earliest of many sessions' due moments.
export function earliestRoomGrantDue(
  holds: Iterable<RoomGrantHold | null>,
  askBeforeMs: number,
): number | null {
  let due: number | null = null;
  for (const hold of holds) {
    const at = roomGrantDueAt(hold, askBeforeMs);
    if (at !== null && (due === null || at < due)) due = at;
  }
  return due;
}

// What a session's grant needs now: close it (`lapsed`), ask for a fresh one (`ask`), or nothing.
export function roomGrantStep(
  hold: RoomGrantHold | null,
  now: number,
  askBeforeMs: number,
): 'lapsed' | 'ask' | null {
  if (!hold?.grantExp) return null;
  if (hold.grantExp <= now) return 'lapsed';
  if (!hold.renewAsked && hold.grantExp - askBeforeMs <= now) return 'ask';
  return null;
}

// The longest renewal a room reads off a `grant` frame.
export const ROOM_GRANT_MAX_LENGTH = 8192;

export type RoomGrantRenewal =
  | { kind: 'renewed'; grantExp: number; claims: GrantClaims }
  // The fresh grant says a different level or tab: the session ends, and its editor rejoins with what it holds.
  | { kind: 'changed'; level: Level; tab: string | null }
  // Forged, lapsed, for another item, or not a ticket at all: ignored, and the old grant still lapses.
  | { kind: 'invalid' };

// A session's `grant` frame, checked against the access the session holds now.
export async function renewRoomGrant(
  service: Pick<IndexService, 'verifyGrant'>,
  env: IndexEnv,
  ticket: unknown,
  itemId: string,
  held: { level: Level | null | undefined; tab: string | null | undefined },
): Promise<RoomGrantRenewal> {
  if (typeof ticket !== 'string' || ticket.length > ROOM_GRANT_MAX_LENGTH)
    return { kind: 'invalid' };
  const opened = await openRoomTicket(service, env, ticket, itemId);
  if (!opened) return { kind: 'invalid' };
  const level = roomTicketLevel(opened);
  const tab = opened.claims.tab ?? null;
  if (level !== held.level || tab !== (held.tab ?? null)) return { kind: 'changed', level, tab };
  return { kind: 'renewed', grantExp: opened.claims.exp * 1000, claims: opened.claims };
}
