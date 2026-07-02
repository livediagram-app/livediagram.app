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

export async function createWsTicket(
  env: Env,
  diagramId: string,
  role: ShareRole,
  now = Date.now(),
): Promise<string> {
  // Opportunistic sweep so the table never accumulates: every mint
  // clears anything already expired (volume is one row per room join).
  await env.DB.prepare('DELETE FROM ws_tickets WHERE expires_at <= ?').bind(now).run();
  const ticket = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO ws_tickets (ticket, diagram_id, role, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(ticket, diagramId, role, now + WS_TICKET_TTL_MS)
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
  diagramId: string,
  now = Date.now(),
): Promise<ShareRole | null> {
  const row = await env.DB.prepare(
    'DELETE FROM ws_tickets WHERE ticket = ? AND diagram_id = ? AND expires_at > ? RETURNING role',
  )
    .bind(ticket, diagramId, now)
    .first<{ role: string }>();
  return row?.role === 'edit' || row?.role === 'view' ? row.role : null;
}
