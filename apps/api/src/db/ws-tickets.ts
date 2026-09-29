// ws_tickets — one-time WebSocket room tickets (migration 0037).
//
// The WS upgrade can't carry the Bearer token or the guest signature
// (browser limitation), so role resolution for identified callers runs
// over authenticated REST instead: mint here, consume once on upgrade.
// Tickets are deliberately dumb rows — a random 128-bit id, the diagram
// it was minted for, the server-resolved role, and a short expiry — so
// possession of a ticket proves exactly one thing: this browser passed
// the REST access gates for this diagram moments ago.

import type { Env, ShareRole } from '../types';

// Long enough to cover a slow page load between mint and upgrade; short
// enough that a leaked ticket is useless almost immediately.
const WS_TICKET_TTL_MS = 60_000;

// What a ticket admits its holder with: the role, and for a share-link
// visitor the tab scope and the code (docs/specs/013-workspace/tab-scoped-share-links.md), so the room can
// confine the session and close it when that code is revoked or rescoped.
export type WsAdmission = { role: ShareRole; tabScope: string | null; shareCode: string | null };

export async function createWsTicket(
  env: Env,
  documentId: string,
  admission: WsAdmission,
  now = Date.now(),
): Promise<string> {
  // Opportunistic sweep so the table never accumulates: every mint
  // clears anything already expired (volume is one row per room join).
  await env.DB.prepare('DELETE FROM ws_tickets WHERE expires_at <= ?').bind(now).run();
  const ticket = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO ws_tickets (ticket, document_id, role, expires_at, tab_scope, share_code) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(
      ticket,
      documentId,
      admission.role,
      now + WS_TICKET_TTL_MS,
      admission.tabScope,
      admission.shareCode,
    )
    .run();
  return ticket;
}

// Atomic single-use consume: DELETE ... RETURNING makes replay
// impossible (a second presentation of the same ticket matches no row).
// Diagram-scoped so a ticket minted for one diagram can't open another
// diagram's room.
export async function consumeWsTicket(
  env: Env,
  ticket: string,
  documentId: string,
  now = Date.now(),
): Promise<WsAdmission | null> {
  const row = await env.DB.prepare(
    'DELETE FROM ws_tickets WHERE ticket = ? AND document_id = ? AND expires_at > ? RETURNING role, tab_scope, share_code',
  )
    .bind(ticket, documentId, now)
    .first<{ role: string; tab_scope?: string | null; share_code?: string | null }>();
  if (row?.role !== 'edit' && row?.role !== 'view') return null;
  return { role: row.role, tabScope: row.tab_scope ?? null, shareCode: row.share_code ?? null };
}
