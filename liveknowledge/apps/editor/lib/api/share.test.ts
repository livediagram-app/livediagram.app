import { IndexError } from '@liveworkspace/index-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The share resolve's refusals (docs/specs/013-workspace/share-password.md "The restricted page"): the document's
// sign-in rule gives the restricted page with its domains, on the bare code's resolve and on the grant asked with the
// document's id alike; a code the index does not know, or one turned off, opens nothing (Link Not Valid).

const grants = vi.hoisted(() => ({
  documentGrant: vi.fn(),
  documentGrantRefusal: vi.fn(),
  documentGrantRefusalDomains: vi.fn(),
}));
const index = vi.hoisted(() => ({ resolveShare: vi.fn() }));

vi.mock('./document-grants', () => grants);
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: index }));
vi.mock('./core', () => ({
  API_BASE: '/api',
  apiHeaders: vi.fn(async () => ({})),
  apiFetch: vi.fn(),
  expectOkOrNull: vi.fn(),
  getSessionSharePassword: () => null,
}));

const { apiLoadShared } = await import('./share');

beforeEach(() => {
  vi.clearAllMocks();
  grants.documentGrant.mockResolvedValue(null);
  grants.documentGrantRefusalDomains.mockReturnValue(null);
});

describe('apiLoadShared on the grant path (the document id known)', () => {
  it('turns a guest away to the sign-in page, with the domains', async () => {
    grants.documentGrantRefusal.mockReturnValue('sign_in_required');
    grants.documentGrantRefusalDomains.mockReturnValue(['acme.com']);
    expect(await apiLoadShared('CODE1', 'guest', 'D1')).toEqual({
      passwordRequired: true,
      invalid: false,
      restricted: { reason: 'sign_in', domains: ['acme.com'] },
    });
    expect(grants.documentGrantRefusalDomains).toHaveBeenCalledWith('D1', {
      code: 'CODE1',
      password: null,
    });
  });

  it('tells an account at another domain which domains the link is for', async () => {
    grants.documentGrantRefusal.mockReturnValue('domain_not_allowed');
    grants.documentGrantRefusalDomains.mockReturnValue(['acme.com', 'b.org']);
    expect(await apiLoadShared('CODE2', 'u1', 'D1')).toEqual({
      passwordRequired: true,
      invalid: false,
      restricted: { reason: 'domain', domains: ['acme.com', 'b.org'] },
    });
  });

  it('still asks for a password', async () => {
    grants.documentGrantRefusal.mockReturnValue('password_invalid');
    expect(await apiLoadShared('CODE3', 'u1', 'D1')).toEqual({
      passwordRequired: true,
      invalid: true,
    });
  });

  it('opens nothing for a code the index does not know or turned off', async () => {
    grants.documentGrantRefusal.mockReturnValue('not_found');
    expect(await apiLoadShared('CODE4', 'u1', 'D1')).toBeNull();
  });
});

describe('apiLoadShared on the bare code', () => {
  it('turns a guest away to the sign-in page, with the domains', async () => {
    index.resolveShare.mockRejectedValue(
      new IndexError(401, 'sign_in_required', null, null, ['acme.com']),
    );
    expect(await apiLoadShared('CODE5', 'guest')).toEqual({
      passwordRequired: true,
      invalid: false,
      restricted: { reason: 'sign_in', domains: ['acme.com'] },
    });
    expect(grants.documentGrant).not.toHaveBeenCalled();
  });

  it('tells an account at another domain which domains the link is for', async () => {
    index.resolveShare.mockRejectedValue(
      new IndexError(403, 'domain_not_allowed', null, null, ['acme.com']),
    );
    expect(await apiLoadShared('CODE6', 'u1')).toEqual({
      passwordRequired: true,
      invalid: false,
      restricted: { reason: 'domain', domains: ['acme.com'] },
    });
  });

  it('opens nothing for a code the index does not know or turned off', async () => {
    index.resolveShare.mockRejectedValue(new IndexError(404, 'not_found'));
    expect(await apiLoadShared('CODE7', 'u1')).toBeNull();
  });

  it('throws what is not the index refusing', async () => {
    index.resolveShare.mockRejectedValue(new Error('down'));
    await expect(apiLoadShared('CODE8', 'u1')).rejects.toThrow('down');
  });
});
