// The ticket a socket joins a document's room with (`/api/documents/:id/ws?t=`), and renews its session with (the
// `grant` frame, room-messages.ts): the index's grant itself. A browser can't put headers on a WebSocket upgrade,
// so it goes on the URL; it is short-lived (ten minutes) and names its document.
//
// A workbench session's ticket carries one fact more, its pairing (so unpairing closes exactly its sockets) and
// its level cap, sealed to the grant with this app's key: `<grant>~<pairing>~<cap>~<hmac>`. Nothing else may
// claim a pairing.

import { isAccessLevel, type AccessLevel } from '@livedocuments/api-schema';
import type { GrantClaims } from '@liveworkspace/index-client';
import { timingSafeEqual } from './auth/timing-safe';
import { verifyDocumentGrant } from './index-service';
import type { Env } from './types';

const SEP = '~';

export type RoomTicket = {
  claims: GrantClaims;
  grant: string;
  workbench: { pairing: string; cap: AccessLevel } | null;
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

function sealed(grant: string, pairing: string, cap: AccessLevel): string {
  return `room-ticket:v1${SEP}${grant}${SEP}${pairing}${SEP}${cap}`;
}

export async function sealRoomTicket(
  env: Pick<Env, 'INDEX_KEY'>,
  grant: string,
  workbench: { pairing: string; cap: AccessLevel } | null,
): Promise<string> {
  if (!workbench) return grant;
  if (!env.INDEX_KEY) throw new Error('no INDEX_KEY to seal a workbench ticket');
  const mac = await hmacHex(env.INDEX_KEY, sealed(grant, workbench.pairing, workbench.cap));
  return [grant, workbench.pairing, workbench.cap, mac].join(SEP);
}

// The ticket's grant, checked against the index's keys and this document, and its sealed workbench facts. Null for
// anything forged, lapsed or for another document.
export async function openRoomTicket(
  env: Pick<Env, 'INDEX_ORIGIN' | 'INDEX_KEY'>,
  ticket: string | null | undefined,
  documentId: string,
): Promise<RoomTicket | null> {
  if (!ticket) return null;
  const parts = ticket.split(SEP);
  let workbench: RoomTicket['workbench'] = null;
  if (parts.length === 4) {
    const [grant, pairing, cap, mac] = parts as [string, string, string, string];
    if (!env.INDEX_KEY || !isAccessLevel(cap)) return null;
    const expected = await hmacHex(env.INDEX_KEY, sealed(grant, pairing, cap));
    if (!(await timingSafeEqual(expected, mac))) return null;
    workbench = { pairing, cap };
  } else if (parts.length !== 1) {
    return null;
  }
  const grant = parts[0]!;
  const claims = await verifyDocumentGrant(env, grant, documentId);
  return claims ? { claims, grant, workbench } : null;
}
