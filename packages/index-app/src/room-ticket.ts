// The ticket a socket joins an item's room with (`…/ws?t=`), and renews its session with: the index's grant itself
// (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"). A browser can't put headers on a WebSocket upgrade, so it
// goes on the URL; it is short-lived (ten minutes) and names its item.
//
// A workbench session's ticket carries two facts more, its pairing (so unpairing closes exactly its sockets) and its
// level cap, and it must never hand the session the grant itself: the index's grant is the owner's, at the owner's
// full level, and a bare grant opens the room (`?t=`) and the REST routes (`X-Index-Grant`) uncapped and unpaired.
// So the grant, the pairing and the cap are encrypted together (AES-GCM, a key derived from the app's INDEX_KEY):
// `rt2~<base64url(iv | ciphertext)>`. The session can read none of it and change none of it. Nothing else may claim
// a pairing.

import { isLevel, type GrantClaims, type Level } from '@liveworkspace/index-client';
import type { IndexEnv, IndexService } from './service';

const SEP = '~';
const SEALED_PREFIX = `rt2${SEP}`;
const IV_BYTES = 12;
const AAD = new TextEncoder().encode('liveworkspace room-ticket v2');

export type RoomTicketWorkbench = { pairing: string; cap: Level };

export type RoomTicket = {
  claims: GrantClaims;
  grant: string;
  workbench: RoomTicketWorkbench | null;
};

// The sealing key, derived once per isolate (and again only if INDEX_KEY changes) rather than on every ticket.
let sealingKey: { secret: string; key: Promise<CryptoKey> } | null = null;

async function deriveSealingKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('liveworkspace room-ticket aes-gcm v2'),
    },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function sealingKeyFor(secret: string): Promise<CryptoKey> {
  if (sealingKey?.secret !== secret) sealingKey = { secret, key: deriveSealingKey(secret) };
  return sealingKey.key;
}

function toBase64Url(bytes: Uint8Array): string {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const plain = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(plain, (c) => c.charCodeAt(0));
}

type SealedFacts = { g: string; p: string; c: Level };

// The ticket's sealed facts, or null for anything this key did not seal (forged, tampered, another key, garbage).
async function unseal(secret: string, body: string): Promise<SealedFacts | null> {
  try {
    const bytes = fromBase64Url(body);
    if (bytes.length <= IV_BYTES) return null;
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES), additionalData: AAD },
      await sealingKeyFor(secret),
      bytes.slice(IV_BYTES),
    );
    const facts = JSON.parse(new TextDecoder().decode(plain)) as Partial<SealedFacts>;
    if (typeof facts.g !== 'string' || typeof facts.p !== 'string' || !isLevel(facts.c))
      return null;
    return { g: facts.g, p: facts.p, c: facts.c };
  } catch {
    return null;
  }
}

// The room's ticket for a grant: the grant as it is, or, for a workbench session, the grant sealed with its pairing
// and cap so the session never holds the grant itself.
export async function sealRoomTicket(
  env: Pick<IndexEnv, 'INDEX_KEY'>,
  grant: string,
  workbench: RoomTicketWorkbench | null,
): Promise<string> {
  if (!workbench) return grant;
  if (!env.INDEX_KEY) throw new Error('no INDEX_KEY to seal a workbench ticket');
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const facts: SealedFacts = { g: grant, p: workbench.pairing, c: workbench.cap };
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: AAD },
      await sealingKeyFor(env.INDEX_KEY),
      new TextEncoder().encode(JSON.stringify(facts)),
    ),
  );
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv);
  out.set(sealed, IV_BYTES);
  return SEALED_PREFIX + toBase64Url(out);
}

// The ticket's grant, checked against the index's keys and this item, and its sealed workbench facts. Null for
// anything forged, lapsed or for another item. A grant never holds the separator, so a ticket that does is a sealed
// one or nothing (the old `<grant>~<pairing>~<cap>~<hmac>` shape, which showed the grant, is refused).
export async function openRoomTicket(
  service: Pick<IndexService, 'verifyGrant'>,
  env: IndexEnv,
  ticket: string | null | undefined,
  itemId: string,
): Promise<RoomTicket | null> {
  if (!ticket) return null;
  let grant = ticket;
  let workbench: RoomTicketWorkbench | null = null;
  if (ticket.startsWith(SEALED_PREFIX)) {
    if (!env.INDEX_KEY) return null;
    const facts = await unseal(env.INDEX_KEY, ticket.slice(SEALED_PREFIX.length));
    if (!facts) return null;
    grant = facts.g;
    workbench = { pairing: facts.p, cap: facts.c };
  } else if (ticket.includes(SEP)) {
    return null;
  }
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

// The sockets the grant clock watches: the open ones. A socket the room has closed (its grant lapsed, its access
// changed) can stay in `getWebSockets()` until its peer answers the close, and a laptop asleep never does. Its grant
// is still the lapsed one, so counting it re-arms the room's alarm in the past and the alarm fires back to back until
// the connection finally drops. It has nothing left to ask or lapse, so it is skipped.
export const ROOM_SOCKET_OPEN = 1; // WebSocket.OPEN
export function openRoomSockets<W extends { readyState: number }>(sockets: Iterable<W>): W[] {
  const open: W[] = [];
  for (const ws of sockets) if (ws.readyState === ROOM_SOCKET_OPEN) open.push(ws);
  return open;
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
  // `pairing`: the workbench pairing the session was opened with (null or absent for none). A renewal must be sealed
  // to the same one, so a workbench session never renews with a bare grant or another pairing's ticket, and keeps
  // its cap.
  held: {
    level: Level | null | undefined;
    tab: string | null | undefined;
    pairing?: string | null | undefined;
  },
): Promise<RoomGrantRenewal> {
  if (typeof ticket !== 'string' || ticket.length > ROOM_GRANT_MAX_LENGTH)
    return { kind: 'invalid' };
  const opened = await openRoomTicket(service, env, ticket, itemId);
  if (!opened) return { kind: 'invalid' };
  const level = roomTicketLevel(opened);
  const tab = opened.claims.tab ?? null;
  const pairing = opened.workbench?.pairing ?? null;
  if (level !== held.level || tab !== (held.tab ?? null) || pairing !== (held.pairing ?? null))
    return { kind: 'changed', level, tab };
  return { kind: 'renewed', grantExp: opened.claims.exp * 1000, claims: opened.claims };
}
