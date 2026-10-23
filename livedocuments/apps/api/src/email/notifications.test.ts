import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEnv } from '../types';

// The owner's address and switches are the liveworkspace accounts Worker's (person/, tested on its own).
vi.mock('../person/account-app', () => ({ ownerEmail: vi.fn() }));
vi.mock('../person/settings', () => ({ getNotificationPrefs: vi.fn() }));
vi.mock('../document-room/document-content', () => ({
  claimCommentNotify: vi.fn(),
}));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import { ownerEmail } from '../person/account-app';
import { getNotificationPrefs } from '../person/settings';
import { claimCommentNotify } from '../document-room/document-content';
import { sendEmail } from './client';
import { commentNotificationEmail } from './templates';
import { notifyNewComment } from './notifications';

const env = { RESEND_API_KEY: 're', APP_BASE_URL: 'https://app.test' } as unknown as DocumentEnv;
const liveDoc = { id: 'd1', ownerId: 'u1', name: 'Roadmap' };
const allowAll = {
  notifyDocumentJoin: true,
  notifyInviteResponse: true,
  notifyComments: true,
  notifyTips: true,
  notifyMilestones: true,
  notifyActionAssigned: true,
  notifyMentions: true,
};

afterEach(() => vi.clearAllMocks());

describe('commentNotificationEmail', () => {
  it('names the commenter + document, links to the document, omits comment text', () => {
    const e = commentNotificationEmail(env, 'Roadmap', 'd1', 'Anna');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('https://app.test/document/d1');
    // Footer links to the profile so the owner can turn it off (per request).
    expect(e.html).toContain('https://app.test/explorer?settings=notifications');
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });

  it('falls back to "Someone" / "your document" when unknown', () => {
    const e = commentNotificationEmail(env, '', 'd1', null);
    expect(e.subject).toMatch(/Someone/);
    expect(e.html).toContain('your document');
  });
});

describe('notifyNewComment', () => {
  it('does nothing when email is off', async () => {
    await notifyNewComment({} as DocumentEnv, liveDoc, 'Anna');
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
