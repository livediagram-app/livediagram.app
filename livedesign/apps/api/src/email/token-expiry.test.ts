import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

vi.mock('../db', () => ({
  apiTokensExpiringSoon: vi.fn(),
  markApiTokenExpiryWarned: vi.fn(),
  getOwnerEmail: vi.fn(),
}));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import { apiTokensExpiringSoon, getOwnerEmail, markApiTokenExpiryWarned } from '../db';
import { sendEmail } from './client';
import { tokenExpiringEmail } from './templates';
import { runTokenExpirySweep } from './token-expiry';

const env = { RESEND_API_KEY: 're', APP_BASE_URL: 'https://app.test' } as unknown as Env;
afterEach(() => vi.clearAllMocks());

describe('tokenExpiringEmail', () => {
  it('names the token + a human expiry date and links to Tokens', () => {
    const e = tokenExpiringEmail(env, 'CI deploy', Date.UTC(2026, 0, 5));
    expect(e.subject).toMatch(/expires/i);
    expect(e.html).toContain('CI deploy');
    expect(e.html).toContain('January 5, 2026');
    expect(e.html).toContain('https://app.test/explorer?settings=tokens');
  });

  it('falls back when the token is unnamed', () =>
    expect(tokenExpiringEmail(env, null, Date.UTC(2026, 0, 5)).html).toContain('an API token'));
});

describe('runTokenExpirySweep', () => {
  it('does nothing when email is off', async () => {
    await runTokenExpirySweep({} as Env);
    expect(apiTokensExpiringSoon).not.toHaveBeenCalled();
  });

  it('sends + stamps each token that has a known owner address', async () => {
    vi.mocked(apiTokensExpiringSoon).mockResolvedValue([
      { id: 't1', ownerId: 'u1', name: 'CI', expiresAt: Date.UTC(2026, 0, 5) },
    ]);
    vi.mocked(getOwnerEmail).mockResolvedValue('a@b.com');
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await runTokenExpirySweep(env);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(markApiTokenExpiryWarned).toHaveBeenCalledWith(env, 't1');
  });

  it('skips without stamping when the owner has no stored address', async () => {
    vi.mocked(apiTokensExpiringSoon).mockResolvedValue([
      { id: 't1', ownerId: 'u1', name: null, expiresAt: 1 },
    ]);
    vi.mocked(getOwnerEmail).mockResolvedValue(null);
    await runTokenExpirySweep(env);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(markApiTokenExpiryWarned).not.toHaveBeenCalled();
  });

  it('does not stamp when the send fails (so the next run retries)', async () => {
    vi.mocked(apiTokensExpiringSoon).mockResolvedValue([
      { id: 't1', ownerId: 'u1', name: null, expiresAt: 1 },
    ]);
    vi.mocked(getOwnerEmail).mockResolvedValue('a@b.com');
    vi.mocked(sendEmail).mockResolvedValue({ sent: false });
    await runTokenExpirySweep(env);
    expect(markApiTokenExpiryWarned).not.toHaveBeenCalled();
  });
});
