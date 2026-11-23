import { describe, expect, it } from 'vitest';
import { AGENT_NAME_HEADER, pageCreatorOf, readerOf } from './knowledge-caller';

// insights.md "Connected agents": a connection is named as its writes are (page-writer.ts writerOf).
describe('readerOf', () => {
  const request = (headers: Record<string, string> = {}) =>
    new Request('https://api.test/x', { headers });
  const token = { id: 't', name: 'Claude Code' };

  it("names an agent by its client, else its token's name, else its door", () => {
    expect(readerOf({ request: request({ [AGENT_NAME_HEADER]: 'Cursor' }), token })).toEqual({
      kind: 'agent',
      name: 'Cursor',
    });
    expect(readerOf({ request: request(), token })).toEqual({ kind: 'agent', name: 'Claude Code' });
    expect(readerOf({ request: request(), token: { id: 't', name: '  ' } })).toEqual({
      kind: 'agent',
      name: 'API Token',
    });
  });

  it('is a person without a token or an agent door', () => {
    expect(readerOf({ request: request(), token: null })).toEqual({ kind: 'person' });
  });
});

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
