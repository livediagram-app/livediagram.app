import { describe, expect, it } from 'vitest';
import { rowToShareLink, type ShareLinkRow } from './share-link-row';

// rowToShareLink is read-side: every list / lookup of share links
// for a diagram passes through it. The role column on D1 is typed
// as a free-form string, but the wire DTO + the client + the api
// worker's own permission checks all branch on the narrow
// 'edit' | 'view' union. A regression in the mapper's `=== 'view'`
// check would either downgrade every edit link to view (locking
// owners out of their own share links) or upgrade view links to
// edit (a security-shaped issue, even if upstream validation
// catches it on write).

function row(over: Partial<ShareLinkRow> = {}): ShareLinkRow {
  return {
    code: 'ABCD2345',
    diagram_id: 'diag-1',
    role: 'edit',
    created_at: 1717000000000,
    expiry: null,
    expires_at: null,
    ...over,
  };
}

describe('rowToShareLink', () => {
  it('maps every column to its DTO field shape', () => {
    const dto = rowToShareLink(row());
    expect(dto.code).toBe('ABCD2345');
    expect(dto.diagramId).toBe('diag-1');
    expect(dto.role).toBe('edit');
    expect(dto.createdAt).toBe(1717000000000);
    expect(dto.expiry).toBe('never');
    expect(dto.expiresAt).toBeNull();
  });

  it('maps the expiry columns through (spec/34)', () => {
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

  it('defaults to role "edit" when the column carries an unrecognised string', () => {
    // The defensive default: any non-'view' value (a future server
    // role the client doesn't know about yet, a corrupted row, a
    // typo) lands on 'edit'. spec/04 + spec/11: roles are validated
    // on write, so reading an unexpected value here is the
    // belt-and-braces path. Edit is the safe default because the
    // alternative (view-only) would silently lock owners out of
    // their own share links if the value ever drifted.
    expect(rowToShareLink(row({ role: 'admin' })).role).toBe('edit');
    expect(rowToShareLink(row({ role: 'owner' })).role).toBe('edit');
    expect(rowToShareLink(row({ role: '' })).role).toBe('edit');
  });

  it('is case-sensitive on the "view" string', () => {
    // Sanity: the equality check is strict, not normalised. A
    // database that started inserting 'VIEW' (caps) would slip
    // through to 'edit' here. The api worker controls writes so
    // this never happens in practice, but the test pins the
    // contract so a future "lowercase the input" change is a
    // deliberate decision, not an accident.
    expect(rowToShareLink(row({ role: 'VIEW' })).role).toBe('edit');
    expect(rowToShareLink(row({ role: 'View' })).role).toBe('edit');
  });

  it('preserves edit when the column has trailing whitespace', () => {
    // Same strictness goes the other way: 'view ' (with a space)
    // is not 'view', so it lands on the edit default. Pins the
    // contract.
    expect(rowToShareLink(row({ role: 'view ' })).role).toBe('edit');
  });
});
