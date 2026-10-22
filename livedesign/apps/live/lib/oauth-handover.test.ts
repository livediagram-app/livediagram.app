// The consent and device pages' mint-then-hand-over sequence (docs/specs/015-api/mcp-server.md §3 "Consent + mint"):
// a token is only minted for a request that can still take it, and a token the MCP did not take is revoked, so a
// failed Connect never leaves a live six-month token counting towards the per-account cap.
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api/core';
import { handoverFailureCopy, mintAndHandOver, type HandoverSteps } from './oauth-handover';

const MINTED = { token: 'lvd_secret', id: 'tok-1', expiresAt: 1_800_000_000_000 };

function steps(over: Partial<HandoverSteps<string>> = {}) {
  return {
    sessionLive: vi.fn(async () => true),
    mint: vi.fn(async () => MINTED),
    complete: vi.fn(async (): Promise<string | null> => 'https://client.example/cb?code=x'),
    revoke: vi.fn(async () => {}),
    ...over,
  };
}

describe('mintAndHandOver', () => {
  it('mints and hands the token over when the session is live', async () => {
    const s = steps();
    expect(await mintAndHandOver(s)).toEqual({
      ok: true,
      value: 'https://client.example/cb?code=x',
    });
    expect(s.complete).toHaveBeenCalledWith(MINTED.token, MINTED.expiresAt);
    expect(s.revoke).not.toHaveBeenCalled();
  });

  it('does not mint when the session has expired', async () => {
    const s = steps({ sessionLive: vi.fn(async () => false) });
    expect(await mintAndHandOver(s)).toEqual({ ok: false, reason: 'expired' });
    expect(s.mint).not.toHaveBeenCalled();
  });

  it('treats an unreachable session check as expired', async () => {
    const s = steps({ sessionLive: vi.fn(async () => Promise.reject(new Error('offline'))) });
    expect(await mintAndHandOver(s)).toEqual({ ok: false, reason: 'expired' });
    expect(s.mint).not.toHaveBeenCalled();
  });

  it('names the token cap when the api refuses the mint with 409 token_limit_reached', async () => {
    const s = steps({
      mint: vi.fn(async () =>
        Promise.reject(new ApiError('oauth exchange', 409, 'token_limit_reached')),
      ),
    });
    expect(await mintAndHandOver(s)).toEqual({ ok: false, reason: 'token_limit' });
    expect(s.complete).not.toHaveBeenCalled();
  });

  it('reports any other mint failure as failed', async () => {
    const s = steps({
      mint: vi.fn(async () => Promise.reject(new ApiError('oauth exchange', 500, null))),
    });
    expect(await mintAndHandOver(s)).toEqual({ ok: false, reason: 'failed' });
  });

  it('revokes the minted token when the MCP refuses it', async () => {
    const s = steps({ complete: vi.fn(async () => null) });
    expect(await mintAndHandOver(s)).toEqual({ ok: false, reason: 'failed' });
    expect(s.revoke).toHaveBeenCalledWith(MINTED.id);
  });

  it('revokes the minted token when the hand-over throws', async () => {
    const s = steps({ complete: vi.fn(async () => Promise.reject(new Error('network'))) });
    expect(await mintAndHandOver(s)).toEqual({ ok: false, reason: 'failed' });
    expect(s.revoke).toHaveBeenCalledWith(MINTED.id);
  });

  it('still reports the failure when the revoke itself fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = steps({
      complete: vi.fn(async () => null),
      revoke: vi.fn(async () => Promise.reject(new Error('offline'))),
    });
    expect(await mintAndHandOver(s)).toEqual({ ok: false, reason: 'failed' });
    expect(warn).toHaveBeenCalledWith('[oauth] handover revoke failed');
    warn.mockRestore();
  });
});

describe('handoverFailureCopy', () => {
  it('gives each failure its own line', () => {
    expect(handoverFailureCopy('expired', 'Start again.')).toBe(
      'This request has expired. Start again.',
    );
    expect(handoverFailureCopy('token_limit', 'Start again.')).toMatch(/limit of API tokens/);
    expect(handoverFailureCopy('failed', 'Start again.')).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
