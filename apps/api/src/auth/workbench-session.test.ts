import { describe, expect, it } from 'vitest';
import {
  isWorkbenchSessionFormat,
  WORKBENCH_HANDLE_PATTERN,
  WORKBENCH_SESSION_PREFIX,
} from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { insertWorkbenchSession } from '../db/workbench';
import {
  generatePairingCode,
  generateWorkbenchSecret,
  generateWorkbenchTicket,
  hashWorkbenchSecret,
  resolveWorkbenchSession,
} from './workbench-session';

const NOW = 1_800_000_000_000;

describe('workbench secrets', () => {
  it('mints tickets and pairing codes as 22 base64url characters, never twice alike', () => {
    const tickets = new Set(Array.from({ length: 50 }, () => generateWorkbenchTicket()));
    const codes = new Set(Array.from({ length: 50 }, () => generatePairingCode()));

    expect(tickets.size).toBe(50);
    expect(codes.size).toBe(50);
    for (const value of [...tickets, ...codes]) expect(value).toMatch(WORKBENCH_HANDLE_PATTERN);
  });

  it('mints sessions in the lvw_ format', () => {
    const secret = generateWorkbenchSecret();

    expect(secret.startsWith(WORKBENCH_SESSION_PREFIX)).toBe(true);
    expect(isWorkbenchSessionFormat(secret)).toBe(true);
  });

  it('hashes as SHA-256 hex, deterministically', async () => {
    const hash = await hashWorkbenchSecret('lvw_abc');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashWorkbenchSecret('lvw_abc')).toBe(hash);
    expect(await hashWorkbenchSecret('lvw_abd')).not.toBe(hash);
  });
});

describe('resolveWorkbenchSession', () => {
  async function arrange(over: { tokenRevoked?: boolean; tokenReadOnly?: boolean } = {}) {
    const db: SqliteD1 = sqliteD1();
    db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
                 VALUES ('doc1', 'user_1', 'Doc', 0, 1, 1)`);
    db.sql
      .exec(`INSERT INTO api_tokens (id, owner_id, token_hash, name, created_at, expires_at, revoked, read_only)
                 VALUES ('tok1', 'user_1', 'h', NULL, 1, ${NOW + 1e9}, ${over.tokenRevoked ? 1 : 0},
                         ${over.tokenReadOnly ? 1 : 0})`);
    db.sql.exec(`INSERT INTO workbench_pairings (id, owner_id, token_id, origin, name, created_at)
                 VALUES ('pair1', 'user_1', 'tok1', 'https://w.example', 'Spinner', 1)`);
    const secret = generateWorkbenchSecret();
    await insertWorkbenchSession(db.env, {
      id: 'abcdef12-0000-4000-8000-000000000000',
      secretHash: await hashWorkbenchSecret(secret),
      ownerId: 'user_1',
      tokenId: 'tok1',
      pairingId: 'pair1',
      documentId: 'doc1',
      tabId: 't1',
      origin: 'https://w.example',
      role: 'edit',
      createdAt: NOW,
      expiresAt: NOW + 1000,
    });
    return { db, secret };
  }

  it('resolves a live session to its context', async () => {
    const { db, secret } = await arrange();

    expect(await resolveWorkbenchSession(db.env, secret, NOW)).toEqual({
      ok: true,
      workbench: {
        sessionId: 'abcdef12-0000-4000-8000-000000000000',
        ownerId: 'user_1',
        tokenId: 'tok1',
        pairingId: 'pair1',
        documentId: 'doc1',
        tabId: 't1',
        origin: 'https://w.example',
        level: 'edit',
        expiresAt: NOW + 1000,
      },
    });
  });

  it('lowers the level to view when the token is read-only', async () => {
    const { db, secret } = await arrange({ tokenReadOnly: true });

    const resolved = await resolveWorkbenchSession(db.env, secret, NOW);

    expect(resolved.ok && resolved.workbench.level).toBe('view');
  });

  it('refuses an unknown, a revoked and an expired session', async () => {
    const { db, secret } = await arrange();
    const revoked = await arrange({ tokenRevoked: true });

    expect(await resolveWorkbenchSession(db.env, generateWorkbenchSecret(), NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(await resolveWorkbenchSession(revoked.db.env, revoked.secret, NOW)).toEqual({
      ok: false,
      reason: 'revoked',
      sessionPrefix: 'abcdef12',
    });
    expect(await resolveWorkbenchSession(db.env, secret, NOW + 1000)).toEqual({
      ok: false,
      reason: 'expired',
      sessionPrefix: 'abcdef12',
    });
  });
});
