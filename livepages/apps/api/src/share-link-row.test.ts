import { describe, expect, it } from 'vitest';
import { rowToShareLink, type ShareLinkRow } from './share-link-row';

// rowToShareLink is read-side: every list / lookup of share links
// for a document passes through it. The role and level columns on D1 are
// typed as free-form strings, but the wire DTO + the client + the api
// worker's own permission checks all branch on the AccessLevel union
// (docs/specs/013-workspace/share-roles.md). A regression in the mapper
// would either downgrade links or, worse, upgrade a Viewer or Participant.

function row(over: Partial<ShareLinkRow> = {}): ShareLinkRow {
  return {
    code: 'ABCD2345',
    document_id: 'diag-1',
    role: 'edit',
    created_at: 1717000000000,
    expiry: null,
    expires_at: null,
    tab_id: null,
    purpose: 'share',
    level: null,
    ...over,
  };
}

describe('rowToShareLink', () => {
  it('maps every column to its DTO field shape', () => {
    const dto = rowToShareLink(row());
    expect(dto.code).toBe('ABCD2345');
    expect(dto.documentId).toBe('diag-1');
    expect(dto.role).toBe('edit');
    expect(dto.createdAt).toBe(1717000000000);
    expect(dto.expiry).toBe('never');
    expect(dto.expiresAt).toBeNull();
    expect(dto.tabId).toBeNull();
  });

  it('maps the tab scope through (docs/specs/013-workspace/tab-scoped-share-links.md)', () => {
    expect(rowToShareLink(row({ tab_id: 'tab-2' })).tabId).toBe('tab-2');
  });

  it('maps the expiry columns through (docs/specs/013-workspace/share-link-expiry.md)', () => {
    const dto = rowToShareLink(row({ expiry: 'week', expires_at: 1717604800000 }));
    expect(dto.expiry).toBe('week');
    expect(dto.expiresAt).toBe(1717604800000);
    expect(rowToShareLink(row({ expiry: 'month' })).expiry).toBe('month');
    expect(rowToShareLink(row({ expiry: 'sixMonths' })).expiry).toBe('sixMonths');
  });

  it('normalises NULL / unrecognised expiry tokens to "never"', () => {
    // Pre-0020 rows carry NULL in both columns; a corrupted token
    // only changes what Extend re-applies — enforcement reads
    // expires_at in SQL, never this field.
    expect(rowToShareLink(row({ expiry: null })).expiry).toBe('never');
    expect(rowToShareLink(row({ expiry: 'fortnight' })).expiry).toBe('never');
    expect(rowToShareLink(row({ expiry: 'WEEK' })).expiry).toBe('never');
  });

  it('passes role "view" through unchanged', () => {
    expect(rowToShareLink(row({ role: 'view' })).role).toBe('view');
  });

  it('passes role "edit" through unchanged', () => {
    expect(rowToShareLink(row({ role: 'edit' })).role).toBe('edit');
  });

  it('reads the 0080 level column over the legacy role', () => {
    expect(rowToShareLink(row({ role: 'view', level: 'participate' })).role).toBe('participate');
    expect(rowToShareLink(row({ role: 'edit', level: null })).role).toBe('edit');
  });

  it('reads an unrecognised value as view, never higher (blueprint I2)', () => {
    // Fail closed: a value this worker does not know (a future level, a
    // corrupted row, a typo, a case change) never escalates anyone. The
    // columns' CHECKs make it unreachable in practice; this pins the posture.
    for (const role of ['admin', 'owner', '', 'VIEW', 'View', 'EDIT']) {
      expect(rowToShareLink(row({ role })).role).toBe('view');
    }
    expect(rowToShareLink(row({ role: 'edit', level: 'admin' })).role).toBe('view');
  });

  it('reads a value with trailing whitespace as view', () => {
    expect(rowToShareLink(row({ role: 'view ' })).role).toBe('view');
    expect(rowToShareLink(row({ role: 'edit ' })).role).toBe('view');
  });
});
