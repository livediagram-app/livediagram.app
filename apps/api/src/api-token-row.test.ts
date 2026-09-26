import { describe, expect, it } from 'vitest';
import { rowToApiToken, type ApiTokenRow } from './api-token-row';

// The row → DTO step for the token list (docs/specs/015-api/public-api-and-tokens.md). Small, but it is the exact
// point where a database row becomes a response body, so "which fields cross"
// is the whole job.

const row = (over: Partial<ApiTokenRow> = {}): ApiTokenRow => ({
  id: 't1',
  owner_id: 'u1',
  token_hash: 'a'.repeat(64),
  name: 'CI',
  created_at: 10,
  last_used_at: 20,
  expires_at: 30,
  revoked: 0,
  read_only: 0,
  ...over,
});

describe('rowToApiToken (docs/specs/015-api/public-api-and-tokens.md)', () => {
  it('carries the metadata the owner manages tokens by', () => {
    expect(rowToApiToken(row())).toEqual({
      id: 't1',
      name: 'CI',
      createdAt: 10,
      lastUsedAt: 20,
      expiresAt: 30,
      readOnly: false,
    });
  });

  it('never carries the hash or the owner id across', () => {
    // The digest is not the secret, but it is offline-attackable and belongs
    // to nobody outside the worker. An unlisted field is the only guarantee.
    const dto = rowToApiToken(row()) as Record<string, unknown>;
    expect(Object.keys(dto)).toEqual([
      'id',
      'name',
      'createdAt',
      'lastUsedAt',
      'expiresAt',
      'readOnly',
    ]);
    expect(JSON.stringify(dto)).not.toContain('a'.repeat(64));
  });

  it('reads read_only as a boolean, and only 1 means read-only', () => {
    // The column is an integer; anything other than an explicit 1 has to mean
    // full access, or a stray value would silently downgrade a working token.
    expect(rowToApiToken(row({ read_only: 1 })).readOnly).toBe(true);
    expect(rowToApiToken(row({ read_only: 0 })).readOnly).toBe(false);
  });

  it('passes a nameless, never-used token through as nulls', () => {
    const dto = rowToApiToken(row({ name: null, last_used_at: null }));
    expect(dto.name).toBeNull();
    expect(dto.lastUsedAt).toBeNull();
  });
});
