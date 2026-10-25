import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanEnv } from '../types';

vi.mock('../db', () => ({
  claimFormEmail: vi.fn(),
}));
// The owner's address and switches are the liveworkspace accounts Worker's (person/, tested on its own).
vi.mock('../person/account-app', () => ({ ownerEmail: vi.fn() }));
vi.mock('../person/settings', () => ({ getNotificationPrefs: vi.fn() }));
vi.mock('../plan-room/plan-content', () => ({
  claimCommentNotify: vi.fn(),
}));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import { claimFormEmail } from '../db';
import { ownerEmail } from '../person/account-app';
import { getNotificationPrefs } from '../person/settings';
import { claimCommentNotify } from '../plan-room/plan-content';
import { sendEmail } from './client';
import { commentNotificationEmail, formResponseEmail } from './templates';
import { notifyNewComment, notifyFormResponse } from './notifications';

const env = { RESEND_API_KEY: 're', APP_BASE_URL: 'https://app.test' } as unknown as PlanEnv;
const liveDoc = { id: 'd1', ownerId: 'u1', name: 'Roadmap' };
const allowAll = { notifyComments: true, notifyFormResponses: true };

afterEach(() => vi.clearAllMocks());

describe('commentNotificationEmail', () => {
  it('names the commenter + project, links to the project, omits comment text', () => {
    const e = commentNotificationEmail(env, 'Roadmap', 'd1', 'Anna');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('https://app.test/project/d1');
    // Footer links to the profile so the owner can turn it off (per request).
    expect(e.html).toContain('https://app.test/explorer?settings=notifications');
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });

  it('falls back to "Someone" / "your project" when unknown', () => {
    const e = commentNotificationEmail(env, '', 'd1', null);
    expect(e.subject).toMatch(/Someone/);
    expect(e.html).toContain('your plan');
  });
});

describe('notifyNewComment', () => {
  it('does nothing when email is off', async () => {
    await notifyNewComment({} as PlanEnv, liveDoc, 'Anna');
    expect(ownerEmail).not.toHaveBeenCalled();
  });

  it('sends to the owner when they have an address and have not opted out', async () => {
    vi.mocked(ownerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimCommentNotify).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('throttles: no send when a comment email went out recently', async () => {
    vi.mocked(ownerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimCommentNotify).mockResolvedValue(false);
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the owner opted out of comment notifications', async () => {
    vi.mocked(ownerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyComments: false });
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the owner has no stored address (e.g. a guest)', async () => {
    vi.mocked(ownerEmail).mockResolvedValue(null);
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(getNotificationPrefs).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('the form response email (docs/specs/030-forms/forms.md "Hearing about responses")', () => {
  const form = { code: 'c'.repeat(22), heading: 'Bug Report' };

  it('names the form and the card, links the project, and counts what was held', () => {
    const e = formResponseEmail(
      env,
      { heading: 'Bug <Report>', projectId: 'd1', projectName: 'Ops' },
      'Crash',
      3,
    );
    expect(e.kind).toBe('FormResponse');
    expect(e.subject).toBe('New response to Bug <Report>');
    expect(e.html).toContain('Bug &lt;Report&gt;');
    expect(e.html).toContain('<strong>Crash</strong>');
    expect(e.html).toContain('And 3 more responses have arrived');
    expect(e.html).toContain('https://app.test/project/d1');
    expect(
      formResponseEmail(env, { heading: '', projectId: 'd1', projectName: '' }, '', 1).html,
    ).toContain('And 1 more response has arrived');
  });

  it('emails the owner when the per-form claim is won', async () => {
    vi.mocked(ownerEmail).mockResolvedValue('owner@x.test');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimFormEmail).mockResolvedValue({ send: true, heldBefore: 2 });
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyFormResponse(env, liveDoc, form, 'Crash on save');
    expect(sendEmail).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ to: 'owner@x.test', subject: 'New response to Bug Report' }),
    );
  });

  it('holds the email inside the throttle, and respects the opt-out', async () => {
    vi.mocked(ownerEmail).mockResolvedValue('owner@x.test');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimFormEmail).mockResolvedValue({ send: false });
    await notifyFormResponse(env, liveDoc, form, 'Crash');
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyFormResponses: false });
    await notifyFormResponse(env, liveDoc, form, 'Crash');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(claimFormEmail).toHaveBeenCalledTimes(1);
  });

  it('sends nothing without email or an owner address', async () => {
    await notifyFormResponse({ APP_BASE_URL: 'x' } as unknown as PlanEnv, liveDoc, form, 'Crash');
    vi.mocked(ownerEmail).mockResolvedValue(null);
    await notifyFormResponse(env, liveDoc, form, 'Crash');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
