import { describe, expect, it } from 'vitest';
import { accountDeletionOf, deletionCodeSentOf } from './account-deletion';

const answer = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

describe('deletionCodeSentOf', () => {
  it('reads sent, over the limit, and anything else as failed', () => {
    expect(deletionCodeSentOf(answer(200, { sent: true }))).toBe('sent');
    expect(deletionCodeSentOf(answer(429, { error: 'rate_limited' }))).toBe('rate_limited');
    expect(deletionCodeSentOf(answer(502, { error: 'code_not_sent' }))).toBe('failed');
  });
});

describe('accountDeletionOf', () => {
  it.each([
    [answer(200, { deleted: {} }), 'deleted'],
    [answer(429, { error: 'rate_limited' }), 'rate_limited'],
    [answer(502, { error: 'account_not_closed', deleted: {} }), 'account_not_closed'],
    [answer(403, { error: 'invalid_code' }), 'invalid_code'],
    [answer(403, { error: 'too_many_attempts' }), 'too_many_attempts'],
    [answer(403, { error: 'something_else' }), 'failed'],
    [answer(502, { error: 'code_not_checked' }), 'failed'],
    [answer(409, { error: 'plans_remaining' }), 'failed'],
    [answer(500), 'failed'],
  ] as const)('reads %#', async (res, expected) => {
    expect(await accountDeletionOf(res)).toBe(expected);
  });
});
