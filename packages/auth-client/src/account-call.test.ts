// Every Worker call to the accounts site is bounded and goes over the ACCOUNTS binding when the credentials carry it
// (liveworkspace/docs/specs/003-accounts/accounts.md "When the accounts site doesn't answer", Work Tracker 958).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_CALL_TIMEOUT_MS,
  ACCOUNT_WRITE_TIMEOUT_MS,
  AccountCallTimeout,
  call,
  deadlineSignal,
} from './account-call';
import { createTeamFor, mintAccountToken, readSettings } from './account';
import { accountCredentials } from './api-tokens';
import { configured } from './app-auth';
import {
  CODE_TIMEOUT_MS,
  checkDeletionCode,
  closeAccount,
  sendDeletionCode,
} from './close-account';

// A binding that never answers on its own, only to its signal (the stall of 2026-11-15).
function stalledBinding() {
  const seen: { url: string; init?: RequestInit }[] = [];
  const binding = {
    fetch: (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
    },
  };
  return { binding, seen };
}

const PLAIN = {
  accountsUrl: 'https://www.liveworkspace.app',
  clientId: 'client-1',
  clientSecret: 's3cret',
};

// Settles `pending` by `ms` in fake time, and checks it hadn't a moment before. Answers what it threw.
async function failsBy(pending: Promise<unknown>, ms: number): Promise<unknown> {
  let settled = false;
  const caught = pending.then(
    () => {
      settled = true;
      return null;
    },
    (err: unknown) => {
      settled = true;
      return err;
    },
  );
  await vi.advanceTimersByTimeAsync(ms - 1);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(settled).toBe(true);
  return caught;
}

const publicRoute = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  publicRoute.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('deadlineSignal', () => {
  it('aborts with a TimeoutError after its time, on a timer fake time drives', async () => {
    const signal = deadlineSignal(50);
    await vi.advanceTimersByTimeAsync(49);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe('TimeoutError');
  });
});

describe('call', () => {
  it('goes over the binding the credentials carry, never the public route when it answers', async () => {
    const binding = {
      fetch: vi.fn(async (_url: string, _init?: RequestInit) =>
        Response.json({ all: {}, app: {} }),
      ),
    };
    await readSettings(
      { ...PLAIN, accounts: binding },
      { owner: 'user_1', app: 'livediagram.app' },
      publicRoute,
    );
    expect(binding.fetch).toHaveBeenCalledTimes(1);
    expect(binding.fetch.mock.calls[0]![0]).toBe(
      'https://www.liveworkspace.app/api/account/internal/settings/read',
    );
    expect(publicRoute).not.toHaveBeenCalled();
  });

  it('gives up on a stalled binding at ACCOUNT_CALL_TIMEOUT_MS, as a timeout safe to repeat', async () => {
    const { binding } = stalledBinding();
    const err = await failsBy(
      call({ ...PLAIN, accounts: binding }, '/teams/of', { method: 'POST', body: {} }, publicRoute),
      ACCOUNT_CALL_TIMEOUT_MS,
    );
    expect(err).toBeInstanceOf(AccountCallTimeout);
    expect((err as AccountCallTimeout).unconfirmed).toBe(false);
    expect((err as Error).message).toBe('account call /teams/of got no answer in 10000 ms');
    // A timeout is not a broken binding: the public route is never tried after it.
    expect(publicRoute).not.toHaveBeenCalled();
  });

  it('gives the writes that are not safe to repeat longer, and says they may have gone through', async () => {
    const { binding, seen } = stalledBinding();
    const credentials = { ...PLAIN, accounts: binding };
    const minted = await failsBy(
      mintAccountToken(credentials, { accessToken: 'at', name: 'Claude', readOnly: false }),
      ACCOUNT_WRITE_TIMEOUT_MS,
    );
    const team = await failsBy(
      createTeamFor(credentials, { accessToken: 'at', name: 'Design' }),
      ACCOUNT_WRITE_TIMEOUT_MS,
    );
    for (const err of [minted, team]) {
      expect(err).toBeInstanceOf(AccountCallTimeout);
      expect((err as AccountCallTimeout).unconfirmed).toBe(true);
      expect((err as Error).message).toMatch(/may have gone through$/);
    }
    expect(seen.map((s) => s.url)).toEqual([
      'https://www.liveworkspace.app/api/account/internal/tokens',
      'https://www.liveworkspace.app/api/account/internal/teams',
    ]);
  });

  it('passes on any other failure as it was, and uses the public route without a binding', async () => {
    const broken = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Network connection lost.');
    });
    await expect(call(PLAIN, '/emails', { method: 'POST', body: {} }, broken)).rejects.toThrow(
      'Network connection lost.',
    );
    expect(broken).toHaveBeenCalledTimes(1);
  });
});

describe('the credentials carry the ACCOUNTS binding when it is bound', () => {
  const env = {
    ACCOUNTS_URL: 'https://www.liveworkspace.app',
    ACCOUNTS_CLIENT_ID: 'client-1',
    ACCOUNTS_CLIENT_SECRET: 's3cret',
    API_RESOURCE: 'https://livediagram.app/api',
  };
  const ACCOUNTS = { fetch: async () => new Response(null) };

  it('in configured and accountCredentials, and not at all without one', () => {
    expect(configured({ ...env, ACCOUNTS })?.accounts).toBe(ACCOUNTS);
    expect(accountCredentials({ ...env, ACCOUNTS })?.accounts).toBe(ACCOUNTS);
    expect(configured(env)).not.toHaveProperty('accounts');
    expect(accountCredentials(env)).not.toHaveProperty('accounts');
  });
});

describe('closing an account over the binding', () => {
  it("bounds the code's send and check at CODE_TIMEOUT_MS", async () => {
    const { binding, seen } = stalledBinding();
    const credentials = { ...PLAIN, accounts: binding };
    const sent = await failsBy(sendDeletionCode(credentials, 'at', publicRoute), CODE_TIMEOUT_MS);
    const checked = await failsBy(
      checkDeletionCode(credentials, 'at', '123456', publicRoute),
      CODE_TIMEOUT_MS,
    );
    for (const err of [sent, checked]) expect((err as DOMException).name).toBe('TimeoutError');
    expect(seen.map((s) => s.url)).toEqual([
      'https://www.liveworkspace.app/api/auth/delete-account/code',
      'https://www.liveworkspace.app/api/auth/delete-account/check',
    ]);
    expect(publicRoute).not.toHaveBeenCalled();
  });

  it('closes the account itself with no deadline: it waits as long as accounts takes', async () => {
    let answer: ((res: Response) => void) | undefined;
    const binding = {
      fetch: vi.fn(
        (_url: string, _init?: RequestInit) =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
    };
    let done = false;
    const closing = closeAccount({ ...PLAIN, accounts: binding }, 'at', '123456', publicRoute).then(
      () => (done = true),
    );
    await vi.advanceTimersByTimeAsync(CODE_TIMEOUT_MS * 10);
    expect(done).toBe(false);
    expect(binding.fetch.mock.calls[0]![1]?.signal).toBeUndefined();
    answer!(Response.json({ deleted: true }));
    await closing;
    expect(done).toBe(true);
    expect(publicRoute).not.toHaveBeenCalled();
  });
});
