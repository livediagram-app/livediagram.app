import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

vi.mock('../db', () => ({
  getOwnerEmail: vi.fn(),
  getNotificationPrefs: vi.fn(),
  listTeamAdminUserIds: vi.fn(),
  claimMilestone: vi.fn(),
}));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import { claimMilestone, getNotificationPrefs, getOwnerEmail } from '../db';
import { sendEmail } from './client';
import { commentNotificationEmail } from './templates';
import { notifyMilestone, notifyNewComment } from './notifications';

const env = { RESEND_API_KEY: 're', APP_BASE_URL: 'https://app.test' } as unknown as Env;
const diagram = { id: 'd1', ownerId: 'u1', name: 'Roadmap' };
const allowAll = {
  notifyDiagramJoin: true,
  notifyInviteResponse: true,
  notifyComments: true,
  notifyTips: true,
  notifyMilestones: true,
};

afterEach(() => vi.clearAllMocks());

describe('commentNotificationEmail', () => {
  it('names the commenter + diagram, links to the diagram, omits comment text', () => {
    const e = commentNotificationEmail(env, 'Roadmap', 'd1', 'Anna');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('https://app.test/diagram/d1');
    // Footer links to the profile so the owner can turn it off (per request).
    expect(e.html).toContain('https://app.test/explorer/profile');
  });

  it('falls back to "Someone" / "your diagram" when unknown', () => {
    const e = commentNotificationEmail(env, '', 'd1', null);
    expect(e.subject).toMatch(/Someone/);
    expect(e.html).toContain('your diagram');
  });
});

describe('notifyNewComment', () => {
  it('does nothing when email is off', async () => {
    await notifyNewComment({} as Env, diagram, 'Anna');
    expect(getOwnerEmail).not.toHaveBeenCalled();
  });

  it('sends to the owner when they have an address and have not opted out', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyNewComment(env, diagram, 'Anna');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('skips when the owner opted out of comment notifications', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyComments: false });
    await notifyNewComment(env, diagram, 'Anna');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the owner has no stored address (e.g. a guest)', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue(null);
    await notifyNewComment(env, diagram, 'Anna');
    expect(getNotificationPrefs).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyMilestone (spec/64 #6)', () => {
  it('sends + claims at a milestone count when opted in', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimMilestone).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyMilestone(env, 'u1', 10);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('does nothing at a non-milestone count', async () => {
    await notifyMilestone(env, 'u1', 7);
    expect(getOwnerEmail).not.toHaveBeenCalled();
  });

  it('does not send when the claim is lost (a concurrent save already sent)', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimMilestone).mockResolvedValue(false);
    await notifyMilestone(env, 'u1', 10);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the owner opted out of milestones', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyMilestones: false });
    await notifyMilestone(env, 'u1', 10);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
