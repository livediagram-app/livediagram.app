import { describe, expect, it, vi } from 'vitest';
import { applyShareSignIn, shareSignInAskedOf } from './share-sign-in-door';

// one-explorer-contracts.md "Sharing and access": an API client's share sets the item's sign-in rule.
describe('shareSignInAskedOf', () => {
  it('leaves the rule alone when the body names neither field', () => {
    expect(shareSignInAskedOf({ role: 'view' })).toEqual({ rule: null });
  });

  it('reads Require Sign In, and domains as a list or as typed text, which imply it', () => {
    expect(shareSignInAskedOf({ requireSignIn: true })).toEqual({
      rule: { requireAccount: true, domains: [] },
    });
    expect(shareSignInAskedOf({ requireSignIn: false })).toEqual({
      rule: { requireAccount: false, domains: [] },
    });
    expect(shareSignInAskedOf({ domains: ['@Acme.com', 'b.org'] })).toEqual({
      rule: { requireAccount: true, domains: ['acme.com', 'b.org'] },
    });
    expect(shareSignInAskedOf({ domains: '@acme.com, b.org', requireSignIn: true })).toEqual({
      rule: { requireAccount: true, domains: ['acme.com', 'b.org'] },
    });
    expect(shareSignInAskedOf({ domains: null })).toEqual({
      rule: { requireAccount: false, domains: [] },
    });
  });

  it('refuses what the index would', () => {
    expect(shareSignInAskedOf({ requireSignIn: 'yes' })).toEqual({ error: 'invalid_sign_in' });
    expect(shareSignInAskedOf({ domains: [1] })).toEqual({ error: 'invalid_sign_in' });
    expect(shareSignInAskedOf({ domains: 'acme.com', requireSignIn: false })).toEqual({
      error: 'invalid_sign_in',
    });
    expect(shareSignInAskedOf({ domains: 'nope' })).toEqual({
      error: 'invalid_domain',
      domain: 'nope',
    });
    const many = Array.from({ length: 21 }, (_, i) => `d${i}.com`);
    expect(shareSignInAskedOf({ domains: many })).toEqual({ error: 'too_many_domains' });
  });
});

describe('applyShareSignIn', () => {
  it('sets the rule only when one was asked, answering what the index stored', async () => {
    const rule = { requireAccount: true, domains: ['acme.com'] };
    const setShareSignIn = vi.fn(async () => ({ signIn: rule }));
    expect(await applyShareSignIn({ setShareSignIn }, 'i1', null)).toBeNull();
    expect(setShareSignIn).not.toHaveBeenCalled();
    expect(await applyShareSignIn({ setShareSignIn }, 'i1', rule)).toEqual(rule);
    expect(setShareSignIn).toHaveBeenCalledWith('i1', rule);
  });
});
