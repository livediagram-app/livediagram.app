import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

vi.mock('../db', () => ({
  getOwnerEmail: vi.fn(),
  getNotificationPrefs: vi.fn(),
  listTeamAdminUserIds: vi.fn(),
  claimMilestone: vi.fn(),
  claimFirstShare: vi.fn(),
  claimCommentNotify: vi.fn(),
}));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import {
  claimCommentNotify,
  claimFirstShare,
  claimMilestone,
  getNotificationPrefs,
  getOwnerEmail,
} from '../db';
import { sendEmail } from './client';
import { actionAssignedEmail, commentNotificationEmail } from './templates';
import {
  notifyActionAssigned,
  notifyFirstShare,
  notifyMilestone,
  notifyNewComment,
} from './notifications';

const env = { RESEND_API_KEY: 're', APP_BASE_URL: 'https://app.test' } as unknown as Env;
const diagram = { id: 'd1', ownerId: 'u1', name: 'Roadmap' };
const allowAll = {
  notifyDiagramJoin: true,
  notifyInviteResponse: true,
  notifyComments: true,
  notifyTips: true,
  notifyMilestones: true,
  notifyActionAssigned: true,
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
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer/profile');
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
    vi.mocked(claimCommentNotify).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyNewComment(env, diagram, 'Anna');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('throttles: no send when a comment email went out recently', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimCommentNotify).mockResolvedValue(false);
    await notifyNewComment(env, diagram, 'Anna');
    expect(sendEmail).not.toHaveBeenCalled();
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

describe('actionAssignedEmail (spec/68)', () => {
  it('names the assigner, diagram, and action, links to the diagram', () => {
    const e = actionAssignedEmail(env, 'Sam', 'Roadmap', 'd1', 'Review the copy', 'Hero only');
    expect(e.subject).toMatch(/Sam/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('Review the copy');
    expect(e.html).toContain('Hero only');
    expect(e.html).toContain('https://app.test/diagram/d1');
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer/profile');
  });

  it('escapes user-influenced strings and truncates a long description', () => {
    const e = actionAssignedEmail(env, '<b>x</b>', 'Roadmap', 'd1', '<script>', 'y'.repeat(500));
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).not.toContain('<b>x</b>');
    expect(e.html).not.toContain('y'.repeat(201));
    expect(e.html).toContain(`${'y'.repeat(200)}…`);
  });

  it('falls back when the assigner or diagram name is unknown', () => {
    const e = actionAssignedEmail(env, null, '', 'd1', 'Do it', null);
    expect(e.subject).toMatch(/A teammate/);
    expect(e.html).toContain('a shared diagram');
  });
});

describe('notifyActionAssigned (spec/68)', () => {
  const input = {
    assigneeUserId: 'u2',
    assigneeFallbackEmail: 'invited@x.com',
    assignerName: 'Sam',
    diagram: { id: 'd1', name: 'Roadmap' },
    actionName: 'Review the copy',
    description: null,
  };

  it('does nothing when email is off', async () => {
    await notifyActionAssigned({} as Env, input);
    expect(getOwnerEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends to the assignee’s verified address when opted in', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('assignee@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyActionAssigned(env, input);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe('assignee@x.com');
  });

  it('falls back to the team-member invite address when no lifecycle row exists', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue(null);
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyActionAssigned(env, input);
    expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe('invited@x.com');
  });

  it('skips when the assignee opted out', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('assignee@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue({
      ...allowAll,
      notifyActionAssigned: false,
    });
    await notifyActionAssigned(env, input);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when no address is resolvable at all', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue(null);
    await notifyActionAssigned(env, { ...input, assigneeFallbackEmail: null });
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

describe('notifyFirstShare (spec/64 #6)', () => {
  it('sends + claims on a first share when opted in', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimFirstShare).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyFirstShare(env, 'u1');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('does not send when already claimed (not actually the first share)', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimFirstShare).mockResolvedValue(false);
    await notifyFirstShare(env, 'u1');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the owner opted out of milestones', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyMilestones: false });
    await notifyFirstShare(env, 'u1');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
