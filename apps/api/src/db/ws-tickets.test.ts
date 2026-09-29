import { describe, expect, it } from 'vitest';
import { fakeD1 } from '../test-d1';
import { consumeWsTicket, createWsTicket } from './ws-tickets';

const EDIT = { role: 'edit', tabScope: null, shareCode: null } as const;
const VIEW = { role: 'view', tabScope: null, shareCode: null } as const;

// A ws ticket is the only thing standing between "passed the REST access
// gates for this document" and an open realtime socket: the upgrade can't
// carry a Bearer token or a guest signature, so possession of a ticket IS the
// authorisation. Three properties carry that weight — single use, document
// scope, and a short life — and each is one SQL predicate away from being
// silently lost.

describe('createWsTicket (docs/specs/007-editor/live-app.md room auth)', () => {
  it('writes the document, the resolved admission and an expiry a minute out', async () => {
    const db = fakeD1();
    const ticket = await createWsTicket(db.env, 'diag-1', EDIT, 1_000_000);
    const insert = db.one('INSERT INTO ws_tickets');
    expect(insert.bindings).toEqual([ticket, 'diag-1', 'edit', 1_060_000, null, null]);
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md: the ticket carries the scope and the admitting code
  // from the mint to the upgrade.
  it('writes a tab scope and the code that granted it', async () => {
    const db = fakeD1();
    await createWsTicket(db.env, 'diag-1', { role: 'view', tabScope: 't2', shareCode: 'CODE2345' });
    expect(db.one('INSERT INTO ws_tickets').bindings.slice(4)).toEqual(['t2', 'CODE2345']);
  });

  it('mints an unguessable ticket, never a value the caller supplied', async () => {
    const db = fakeD1();
    const first = await createWsTicket(db.env, 'diag-1', VIEW);
    const second = await createWsTicket(db.env, 'diag-1', VIEW);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sweeps expired tickets on the way past', async () => {
    // The table would otherwise grow a row per room join forever; nothing else
    // ever deletes an unused ticket.
    const db = fakeD1();
    await createWsTicket(db.env, 'diag-1', EDIT, 1_000_000);
    expect(db.one('DELETE FROM ws_tickets WHERE expires_at').bindings).toEqual([1_000_000]);
  });
});

describe('consumeWsTicket (docs/specs/007-editor/live-app.md room auth)', () => {
  it('returns the admission the ticket was minted with', async () => {
    const db = fakeD1(() => ({ first: { role: 'view', tab_scope: 't2', share_code: 'CODE2345' } }));
    expect(await consumeWsTicket(db.env, 'tkt', 'diag-1', 5)).toEqual({
      role: 'view',
      tabScope: 't2',
      shareCode: 'CODE2345',
    });
  });

  it('reads an unscoped ticket as every tab', async () => {
    const db = fakeD1(() => ({ first: { role: 'edit' } }));
    expect(await consumeWsTicket(db.env, 'tkt', 'diag-1', 5)).toEqual({
      role: 'edit',
      tabScope: null,
      shareCode: null,
    });
  });

  it('deletes as it reads, so a replay matches no row', async () => {
    // The single-use guarantee is the DELETE ... RETURNING, not a later
    // cleanup: a SELECT here would make every ticket reusable until expiry.
    const db = fakeD1(() => ({ first: { role: 'view' } }));
    await consumeWsTicket(db.env, 'tkt', 'diag-1', 5);
    const stmt = db.one('ws_tickets');
    expect(stmt.sql).toContain('DELETE FROM ws_tickets');
    expect(stmt.sql).toContain('RETURNING role, tab_scope, share_code');
  });

  it('scopes the consume to the document and to unexpired rows', async () => {
    const db = fakeD1(() => ({ first: { role: 'edit' } }));
    await consumeWsTicket(db.env, 'tkt', 'diag-1', 5);
    const stmt = db.one('ws_tickets');
    expect(stmt.bindings).toEqual(['tkt', 'diag-1', 5]);
    expect(stmt.sql).toContain('document_id = ?');
    expect(stmt.sql).toContain('expires_at > ?');
  });

  it('answers null for a ticket that matched nothing', async () => {
    const db = fakeD1(() => ({ first: null }));
    expect(await consumeWsTicket(db.env, 'tkt', 'diag-1')).toBeNull();
  });

  it('refuses a role the schema does not recognise', async () => {
    // Defence in depth against a widened column: an unknown role must not be
    // handed to the room as if it were 'edit'.
    const db = fakeD1(() => ({ first: { role: 'admin' } }));
    expect(await consumeWsTicket(db.env, 'tkt', 'diag-1')).toBeNull();
  });
});
