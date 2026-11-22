// The consent and device pages' mint-then-hand-over sequence (docs/specs/015-api/mcp-server.md §3 "Consent + mint"):
// a token is only minted for a request that can still take it, and a token the MCP did not take is revoked, so a
// failed Connect never leaves a live six-month token counting towards the per-account cap.
import { describe, expect, it, vi } from 'vitest';
import { MAX_API_TOKENS_PER_ACCOUNT } from '@liveworkspace/api-schema/api-tokens';
import { ApiError } from './api/api-error';
import {
  handoverFailureCopy,
  mintAndHandOver,
  RETIRE_WAIT_MS,
  type HandoverSteps,
} from './oauth-handover';

const MINTED = { token: 'lwt_secret', id: 'tok-1', expiresAt: 1_800_000_000_000 };

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
    expect(s.complete).toHaveBeenCalledWith(MINTED.token, MINTED.expiresAt, MINTED.id);
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
    expect(s.revoke).toHaveBeenCalledWith(MINTED.token);
  });

  it('revokes the minted token when the hand-over throws', async () => {
    const s = steps({ complete: vi.fn(async () => Promise.reject(new Error('network'))) });
    expect(await mintAndHandOver(s)).toEqual({ ok: false, reason: 'failed' });
    expect(s.revoke).toHaveBeenCalledWith(MINTED.token);
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

describe('mintAndHandOver, retiring what a reconnect replaces', () => {
  it('retires only after the handover went through, with its answer and the new id', async () => {
    const order: string[] = [];
    const s = steps({
      complete: vi.fn(async () => {
        order.push('complete');
        return 'to';
      }),
      retire: vi.fn(async () => {
        order.push('retire');
      }),
    });
    expect(await mintAndHandOver(s)).toEqual({ ok: true, value: 'to' });
    expect(s.retire).toHaveBeenCalledWith('to', MINTED.id);
    expect(order).toEqual(['complete', 'retire']);
  });

  it('retires nothing when the handover fails, or before a mint', async () => {
    const retire = vi.fn(async () => {});
    await mintAndHandOver(steps({ complete: vi.fn(async () => null), retire }));
    await mintAndHandOver(steps({ sessionLive: vi.fn(async () => false), retire }));
    await mintAndHandOver(
      steps({ mint: vi.fn(async () => Promise.reject(new Error('down'))), retire }),
    );
    expect(retire).not.toHaveBeenCalled();
  });

  it('still connects when the retire fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = steps({ retire: vi.fn(async () => Promise.reject(new Error('offline'))) });
    expect(await mintAndHandOver(s)).toEqual({
      ok: true,
      value: 'https://client.example/cb?code=x',
    });
    expect(warn).toHaveBeenCalledWith('[oauth] replaced token revoke failed');
    warn.mockRestore();
  });

  it('waits for a slow retire no longer than RETIRE_WAIT_MS', async () => {
    vi.useFakeTimers();
    try {
      const s = steps({ retire: vi.fn(() => new Promise<void>(() => {})) });
      const result = mintAndHandOver(s);
      await vi.advanceTimersByTimeAsync(RETIRE_WAIT_MS);
      expect(await result).toEqual({ ok: true, value: 'https://client.example/cb?code=x' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('handoverFailureCopy', () => {
  it('gives each failure its own line', () => {
    expect(handoverFailureCopy('expired', 'Start again.')).toBe(
      'This request has expired. Start again.',
    );
    expect(handoverFailureCopy('token_limit', 'Start again.')).toBe(
      `Your account has reached its limit of ${MAX_API_TOKENS_PER_ACCOUNT} API tokens. Revoke one below, then connect.`,
    );
    expect(MAX_API_TOKENS_PER_ACCOUNT).toBe(20);
    expect(handoverFailureCopy('failed', 'Start again.')).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
