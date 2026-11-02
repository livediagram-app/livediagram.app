// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';

const index = vi.hoisted(() => ({ grant: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: index }));
vi.unmock('@/lib/api/document-grants');

const {
  GRANT_RENEW_BEFORE_MS,
  heldDocumentGrant,
  keepDocumentGrantFresh,
  documentGrant,
  documentGrantRefusal,
  documentIdOfPath,
  resetDocumentGrantsForTests,
  seedDocumentGrant,
  withDocumentGrant,
} = await import('./document-grants');

// The index's grant on a document (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as the editor holds it: one
// request per document per ten minutes however many ask, renewed a minute before it lapses, and sent as X-Index-Grant.

const TEN_MIN = 10 * 60_000;
const grantOf = (name: string, life = TEN_MIN) => ({
  grant: name,
  level: 'edit',
  tabId: null,
  expiresAt: Date.now() + life,
});

beforeEach(() => resetDocumentGrantsForTests());
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('documentGrant', () => {
  it('asks once for concurrent callers and keeps the answer', async () => {
    index.grant.mockResolvedValue(grantOf('g1'));
    const [a, b] = await Promise.all([documentGrant('p1'), documentGrant('p1')]);
    expect(a?.grant).toBe('g1');
    expect(b?.grant).toBe('g1');
    await documentGrant('p1');
    expect(index.grant).toHaveBeenCalledOnce();
    expect(heldDocumentGrant('p1')).toBe('g1');
  });

  it('keeps a grant per link, and sends the link’s code and password', async () => {
    index.grant.mockResolvedValue(grantOf('g-link'));
    await documentGrant('p1', { code: 'C1', password: 'pw' });
    expect(index.grant).toHaveBeenCalledWith('p1', { code: 'C1', password: 'pw' });
    expect(heldDocumentGrant('p1')).toBeNull();
    expect(heldDocumentGrant('p1', { code: 'C1' })).toBe('g-link');
  });

  it('asks again once the grant is within a minute of lapsing', async () => {
    index.grant.mockResolvedValueOnce(grantOf('old', GRANT_RENEW_BEFORE_MS - 1));
    index.grant.mockResolvedValueOnce(grantOf('new'));
    await documentGrant('p1');
    expect((await documentGrant('p1'))?.grant).toBe('new');
  });

  it('remembers why the index refused, and does not ask again straight away', async () => {
    index.grant.mockRejectedValue(new IndexError(401, 'password_required'));
    expect(await documentGrant('p1', { code: 'C' })).toBeNull();
    expect(documentGrantRefusal('p1', { code: 'C' })).toBe('password_required');
    await documentGrant('p1', { code: 'C' });
    expect(index.grant).toHaveBeenCalledOnce();
  });

  it('asks again after a network failure', async () => {
    index.grant.mockRejectedValueOnce(new TypeError('offline'));
    index.grant.mockResolvedValueOnce(grantOf('g'));
    expect(await documentGrant('p1')).toBeNull();
    expect((await documentGrant('p1'))?.grant).toBe('g');
  });

  it('takes a seeded grant (the create’s) without asking', async () => {
    seedDocumentGrant('p1', grantOf('seeded') as never);
    expect((await documentGrant('p1'))?.grant).toBe('seeded');
    expect(index.grant).not.toHaveBeenCalled();
  });

  it('takes the grant the page asked for before its code loaded', async () => {
    (window as { __ldiaGrant?: unknown }).__ldiaGrant = {
      id: 'p1',
      share: '',
      p: Promise.resolve(grantOf('early')),
    };
    expect((await documentGrant('p1'))?.grant).toBe('early');
    expect(index.grant).not.toHaveBeenCalled();
    expect((window as { __ldiaGrant?: unknown }).__ldiaGrant).toBeUndefined();
  });
});

describe('keepDocumentGrantFresh', () => {
  it('renews a minute before expiry, and stops when told', async () => {
    vi.useFakeTimers();
    let n = 0;
    // Each answer lasts ten minutes from when it is given.
    index.grant.mockImplementation(async () => grantOf(`g${++n}`));
    const stop = keepDocumentGrantFresh('p1');
    await vi.advanceTimersByTimeAsync(0);
    expect(index.grant).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(TEN_MIN - GRANT_RENEW_BEFORE_MS - 1_000);
    expect(index.grant).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(index.grant).toHaveBeenCalledTimes(2);
    expect(heldDocumentGrant('p1')).toBe('g2');
    stop();
    await vi.advanceTimersByTimeAsync(TEN_MIN);
    expect(index.grant).toHaveBeenCalledTimes(2);
  });
});

describe('withDocumentGrant', () => {
  it('names the document of a document path, and nothing else', () => {
    expect(documentIdOfPath('/api', '/api/documents/p%201/tabs/t')).toBe('p 1');
    expect(documentIdOfPath('/api', '/api/documents')).toBeNull();
    expect(documentIdOfPath('/api', '/api/self')).toBeNull();
    expect(documentIdOfPath('/api', '/api/images/img-1?d=doc%201')).toBe('doc 1');
    expect(documentIdOfPath('/api', '/api/images/img-1')).toBeNull();
  });

  it('adds the grant for the document and link the request names', async () => {
    index.grant.mockResolvedValue(grantOf('g-share'));
    const init = await withDocumentGrant('/api', '/api/documents/p1/tabs/t1', {
      headers: { 'X-Share-Code': 'C9' },
    });
    expect(new Headers(init?.headers).get('X-Index-Grant')).toBe('g-share');
    expect(index.grant).toHaveBeenCalledWith('p1', { code: 'C9', password: null });
  });

  it('leaves a request that already carries one, or names no document, alone', async () => {
    const carried = { headers: { 'X-Index-Grant': 'mine' } };
    expect(await withDocumentGrant('/api', '/api/documents/p1', carried)).toBe(carried);
    const other = { method: 'POST' };
    expect(await withDocumentGrant('/api', '/api/documents', other)).toBe(other);
    expect(index.grant).not.toHaveBeenCalled();
  });
});
