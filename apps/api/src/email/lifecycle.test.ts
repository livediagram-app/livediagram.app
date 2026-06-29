import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

vi.mock('../db/email-lifecycle', () => ({
  recordSighting: vi.fn(),
  dueForStage: vi.fn(),
  markStageSent: vi.fn(),
  dueForActivation: vi.fn(),
  markActivationSent: vi.fn(),
  dueForWinback: vi.fn(),
  markWinbackSent: vi.fn(),
}));
vi.mock('../db', () => ({ getNotificationPrefs: vi.fn() }));
// Keep emailEnabled + appBaseUrl real; only the network send is mocked.
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import { getNotificationPrefs } from '../db';
import {
  dueForActivation,
  dueForStage,
  dueForWinback,
  markActivationSent,
  markStageSent,
  markWinbackSent,
  recordSighting,
} from '../db/email-lifecycle';
import { sendEmail } from './client';
import { runLifecycleSweep, welcomeOnSighting } from './lifecycle';

const env = { RESEND_API_KEY: 're', APP_BASE_URL: 'https://app.test' } as unknown as Env;

afterEach(() => vi.clearAllMocks());

describe('welcomeOnSighting', () => {
  it('does nothing when email is off', async () => {
    await welcomeOnSighting({} as Env, 'u', 'a@b.com');
    expect(recordSighting).not.toHaveBeenCalled();
  });

  it('sends the welcome + stamps it on a new sighting', async () => {
    vi.mocked(recordSighting).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await welcomeOnSighting(env, 'u', 'a@b.com');
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(markStageSent).toHaveBeenCalledWith(env, 'u', 'welcome');
  });

  it('does not send for a returning user', async () => {
    vi.mocked(recordSighting).mockResolvedValue(false);
    await welcomeOnSighting(env, 'u', 'a@b.com');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not stamp when the send fails (so the cron retries)', async () => {
    vi.mocked(recordSighting).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: false });
    await welcomeOnSighting(env, 'u', 'a@b.com');
    expect(markStageSent).not.toHaveBeenCalled();
  });
});

describe('runLifecycleSweep', () => {
  it('does nothing when email is off', async () => {
    await runLifecycleSweep({} as Env);
    expect(dueForStage).not.toHaveBeenCalled();
  });

  it('sweeps welcome, week1, week2 with widening age cutoffs', async () => {
    vi.mocked(dueForStage).mockResolvedValue([]);
    vi.mocked(dueForActivation).mockResolvedValue([]);
    vi.mocked(dueForWinback).mockResolvedValue([]);
    await runLifecycleSweep(env);
    const calls = vi.mocked(dueForStage).mock.calls;
    expect(calls.map((c) => c[1])).toEqual(['welcome', 'week1', 'week2']);
    const cutoffs = calls.map((c) => c[2] as number);
    expect(cutoffs[0]).toBeGreaterThan(cutoffs[1]!); // welcome=now > week1=now-7d
    expect(cutoffs[1]!).toBeGreaterThan(cutoffs[2]!); // week1 > week2=now-14d
  });

  it('sends + stamps each due row', async () => {
    vi.mocked(dueForStage)
      .mockResolvedValueOnce([{ ownerId: 'u1', email: 'a@b.com' }])
      .mockResolvedValue([]);
    vi.mocked(dueForActivation).mockResolvedValue([]);
    vi.mocked(dueForWinback).mockResolvedValue([]);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await runLifecycleSweep(env);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(markStageSent).toHaveBeenCalledWith(env, 'u1', 'welcome');
  });

  it('nudges + stamps a zero-diagram signup (activation, spec/64 #4)', async () => {
    vi.mocked(dueForStage).mockResolvedValue([]);
    vi.mocked(dueForActivation).mockResolvedValue([{ ownerId: 'u2', email: 'c@d.com' }]);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await runLifecycleSweep(env);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(markActivationSent).toHaveBeenCalledWith(env, 'u2');
  });

  it('win-back: sends + stamps a quiet owner who has tips on (spec/64 #5)', async () => {
    vi.mocked(dueForStage).mockResolvedValue([]);
    vi.mocked(dueForActivation).mockResolvedValue([]);
    vi.mocked(dueForWinback).mockResolvedValue([{ ownerId: 'u3', email: 'e@f.com' }]);
    vi.mocked(getNotificationPrefs).mockResolvedValue({ notifyTips: true } as never);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await runLifecycleSweep(env);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(markWinbackSent).toHaveBeenCalledWith(env, 'u3');
  });

  it('win-back: stamps without sending when the owner opted out of tips', async () => {
    vi.mocked(dueForStage).mockResolvedValue([]);
    vi.mocked(dueForActivation).mockResolvedValue([]);
    vi.mocked(dueForWinback).mockResolvedValue([{ ownerId: 'u4', email: 'g@h.com' }]);
    vi.mocked(getNotificationPrefs).mockResolvedValue({ notifyTips: false } as never);
    await runLifecycleSweep(env);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(markWinbackSent).toHaveBeenCalledWith(env, 'u4');
  });
});
