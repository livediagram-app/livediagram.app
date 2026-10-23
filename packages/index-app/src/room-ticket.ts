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
