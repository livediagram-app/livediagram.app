import { describe, expect, it } from 'vitest';
import { pageCreatorOf } from './knowledge-caller';

// docs/specs/030-knowledgebase/verification.md "The owner": who owns a page their save or create makes.
describe('pageCreatorOf', () => {
  const ctx = (over: Partial<Parameters<typeof pageCreatorOf>[0]> = {}) => ({
    accountUserId: null,
    token: null,
    workbench: null,
    resolveOwner: () => 'user_w',
    ...over,
  });

  it('is the signed-in account', () => {
    expect(pageCreatorOf(ctx({ accountUserId: 'user_a' }))).toBe('user_a');
  });

  it('is the person behind a workbench session, who has no account on the request', () => {
    expect(pageCreatorOf(ctx({ workbench: {} as never }))).toBe('user_w');
  });

  it('is nobody for an API token, a guest or a link visitor', () => {
    expect(pageCreatorOf(ctx({ accountUserId: 'user_a', token: { id: 't' } }))).toBeNull();
    expect(pageCreatorOf(ctx({ resolveOwner: () => 'guest_1' }))).toBeNull();
    expect(pageCreatorOf(ctx({ resolveOwner: () => null }))).toBeNull();
  });
});
