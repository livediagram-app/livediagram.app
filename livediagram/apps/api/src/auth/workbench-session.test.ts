import { describe, expect, it } from 'vitest';
import { isWorkbenchSessionFormat } from '@livediagram/api-schema';
import { sqliteD1 } from '../test-sqlite-d1';
import { workbenchStore } from '../workbench-store';
import { resolveWorkbenchSession, sessionPrefixOf } from './workbench-session';

const NOW = 1_800_000_000_000;

describe('resolveWorkbenchSession', () => {
  async function arrange(
    over: { tokenRevoked?: boolean; tokenReadOnly?: boolean; workspace?: boolean } = {},
  ) {
    const db = sqliteD1();
    const store = workbenchStore(db.env, 'user_1');
    const token = {
      id: 'tok1',
      name: null,
      readOnly: over.tokenReadOnly ?? false,
      expiresAt: NOW + 1e9,
    };
    const { code } = await store.openPairingRequest({
      personId: 'user_1',
      token,
      origin: 'https://w.example',
      scope: over.workspace ? 'workspace' : 'document',
      name: 'Acme Editor',
      now: NOW,
    });
    const answer = await store.answerPairingRequest({ code, answer: 'approve', now: NOW });
    if (answer.outcome !== 'approved') throw new Error('not paired');
    const session = await store.openSession({
      personId: 'user_1',
      tokenId: 'tok1',
      pairingId: answer.pairing.id,
      reach: over.workspace
        ? { scope: 'workspace', itemId: null, folderId: 'fold1' }
        : { scope: 'document', itemId: 'doc1', folderId: null },
      tabId: over.workspace ? null : 't1',
      origin: 'https://w.example',
      role: 'edit',
      now: NOW,
      expiresAt: NOW + 1000,
    });
    if (over.tokenRevoked) await store.endAccess({ tokenId: 'tok1' }, 'revoked');
    return { db, secret: session.secret, id: session.id, pairingId: answer.pairing.id };
  }

  it('issues secrets in the lvw_ format, naming their store', async () => {
    const { secret } = await arrange();

    expect(isWorkbenchSessionFormat(secret)).toBe(true);
  });

  it('resolves a live session to its context', async () => {
    const { db, secret, id, pairingId } = await arrange();

    expect(await resolveWorkbenchSession(db.env, secret, NOW)).toEqual({
      ok: true,
      workbench: {
        sessionId: id,
        ownerId: 'user_1',
        tokenId: 'tok1',
        pairingId,
        scope: 'document',
        documentId: 'doc1',
        folderId: null,
        tabId: 't1',
        origin: 'https://w.example',
        level: 'edit',
        expiresAt: NOW + 1000,
      },
    });
  });

  it('resolves a workspace session to its folder, with no document', async () => {
    const { db, secret } = await arrange({ workspace: true });

    const resolved = await resolveWorkbenchSession(db.env, secret, NOW);

    expect(resolved).toMatchObject({
      ok: true,
      workbench: { scope: 'workspace', documentId: null, folderId: 'fold1', tabId: null },
    });
  });

  it('lowers the level to view when the token is read-only', async () => {
    const { db, secret } = await arrange({ tokenReadOnly: true });

    const resolved = await resolveWorkbenchSession(db.env, secret, NOW);

    expect(resolved.ok && resolved.workbench.level).toBe('view');
  });

  it('refuses an unknown, an unrouted, a revoked token and an expired session', async () => {
    const { db, secret, id } = await arrange();
    const revoked = await arrange({ tokenRevoked: true });
    const elsewhere = `lvw_${'a'.repeat(43)}.${'0f'.repeat(32)}`;

    expect(await resolveWorkbenchSession(db.env, elsewhere, NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(await resolveWorkbenchSession(db.env, `lvw_${'a'.repeat(43)}`, NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    // Ending a token's access removes its sessions, so its secret is unknown from then on.
    expect(await resolveWorkbenchSession(revoked.db.env, revoked.secret, NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(await resolveWorkbenchSession(db.env, secret, NOW + 1000)).toEqual({
      ok: false,
      reason: 'expired',
      sessionPrefix: sessionPrefixOf(id),
    });
    expect(await resolveWorkbenchSession(db.env, secret, NOW + 2e9)).toEqual({
      ok: false,
      reason: 'revoked',
      sessionPrefix: sessionPrefixOf(id),
    });
  });
});
