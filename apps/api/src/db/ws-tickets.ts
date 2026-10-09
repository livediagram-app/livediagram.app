// ws_tickets — one-time WebSocket room tickets (migration 0037).
//
// The WS upgrade can't carry the Bearer token or the guest signature
// (browser limitation), so role resolution for identified callers runs
// over authenticated REST instead: mint here, consume once on upgrade.
// Tickets are deliberately dumb rows — a random 128-bit id, the document
// it was minted for, the server-resolved role, and a short expiry — so
// possession of a ticket proves exactly one thing: this browser passed
// the REST access gates for this document moments ago.

import type { ShareRole, Runtime } from '../types';

// Long enough to cover a slow page load between mint and upgrade; short
// enough that a leaked ticket is useless almost immediately.
const WS_TICKET_TTL_MS = 60_000;

// What a ticket admits its holder with: the role, and for a share-link
// visitor the tab scope and the code (docs/specs/013-workspace/tab-scoped-share-links.md), so the room can
// confine the session and close it when that code is revoked or rescoped.
//
// `account` records that a verified Clerk session minted it, so the room knows which sessions may
// publish a profile picture and which may receive one (docs/specs/014-identity/profile-picture.md §6).
export type WsAdmission = {
  role: ShareRole;
  tabScope: string | null;
  shareCode: string | null;
  account: boolean;
  // The minting account's person tag (personTagFor), so the room can tell an agent's owner's own
  // sessions apart (docs/specs/024-agents/agent-changesets.md "Held elements"). Null for a guest,
  // a share-link visitor without an account, or an API token.
  personTag: string | null;
  // The workbench pairing a workbench session's ticket was minted under
  // (docs/specs/013-workspace/workbench-embeds.md), so the room can close exactly its sockets. Null otherwise.
  workbenchPairing: string | null;
};

export async function createWsTicket(
  env: Runtime,
  documentId: string,
  admission: WsAdmission,
  now = Date.now(),
): Promise<string> {
  // Opportunistic sweep so the table never accumulates: every mint
  // clears anything already expired (volume is one row per room join).
  await env.db.prepare('DELETE FROM ws_tickets WHERE expires_at <= ?').bind(now).run();
  const ticket = crypto.randomUUID();
  await env.db
    .prepare(
      'INSERT INTO ws_tickets (ticket, document_id, role, expires_at, tab_scope, share_code, account, person_tag, workbench_pairing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      ticket,
      documentId,
      admission.role,
      now + WS_TICKET_TTL_MS,
      admission.tabScope,
      admission.shareCode,
      admission.account ? 1 : 0,
      admission.personTag,
      admission.workbenchPairing,
    )
    .run();
  return ticket;
}

// Atomic single-use consume: DELETE ... RETURNING makes replay
// impossible (a second presentation of the same ticket matches no row).
// Document-scoped so a ticket minted for one document can't open another
// document's room.
export async function consumeWsTicket(
  env: Runtime,
  ticket: string,
  documentId: string,
  now = Date.now(),
): Promise<WsAdmission | null> {
  const row = await env.db
    .prepare(
      'DELETE FROM ws_tickets WHERE ticket = ? AND document_id = ? AND expires_at > ? RETURNING role, tab_scope, share_code, account, person_tag, workbench_pairing',
    )
    .bind(ticket, documentId, now)
    .first<{
      role: string;
      tab_scope?: string | null;
      share_code?: string | null;
      account?: number | null;
      person_tag?: string | null;
      workbench_pairing?: string | null;
    }>();
  if (row?.role !== 'edit' && row?.role !== 'view') return null;
  return {
    role: row.role,
    tabScope: row.tab_scope ?? null,
    shareCode: row.share_code ?? null,
    account: row.account === 1,
    personTag: row.person_tag ?? null,
    workbenchPairing: row.workbench_pairing ?? null,
  };
}
