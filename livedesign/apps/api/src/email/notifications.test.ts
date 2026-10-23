import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

vi.mock('../db', () => ({
  listTeamAdminUserIds: vi.fn(),
  claimCommentNotify: vi.fn(),
  claimJoinNotify: vi.fn(),
  claimNotifyEmail: vi.fn(),
}));
// What the liveworkspace accounts Worker keeps (accounts/people.ts, accounts/settings.ts): seams here,
// tested against its stand-in in accounts/*.test.ts.
const people = vi.hoisted(() => ({
  emailOf: vi.fn(),
  emailsOf: vi.fn(),
  claimAccountMilestone: vi.fn(),
}));
vi.mock('../accounts/people', () => people);
vi.mock('../accounts/settings', () => ({ getNotificationPrefs: vi.fn() }));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import { claimCommentNotify, claimJoinNotify, claimNotifyEmail, listTeamAdminUserIds } from '../db';
import { getNotificationPrefs } from '../accounts/settings';
const { emailOf: getOwnerEmail, emailsOf, claimAccountMilestone } = people;
import { sendEmail } from './client';
import { actionAssignedEmail, commentNotificationEmail } from './templates';
import {
  notifyActionAssigned,
  notifyDesignJoin,
  notifyMentioned,
  notifyFirstShare,
  notifyInviteResponse,
  notifyMilestone,
  notifyNewComment,
  NOTIFY_EMAIL_DEDUPE_MS,
  NOTIFY_EMAILS_PER_SENDER_PER_HOUR,
} from './notifications';

const env = { RESEND_API_KEY: 're', APP_BASE_URL: 'https://app.test' } as unknown as Env;
const liveDoc = { id: 'd1', ownerId: 'u1', name: 'Roadmap' };
const allowAll = {
  notifyDesignJoin: true,
  notifyInviteResponse: true,
  notifyComments: true,
  notifyMilestones: true,
  notifyActionAssigned: true,
  notifyMentions: true,
};

afterEach(() => vi.clearAllMocks());

describe('commentNotificationEmail', () => {
  it('names the commenter + design, links to the design, omits comment text', () => {
    const e = commentNotificationEmail(env, 'Roadmap', 'd1', 'Anna');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('https://app.test/design/d1');
    // Footer links to the profile so the owner can turn it off (per request).
    expect(e.html).toContain('https://app.test/explorer?settings=notifications');
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });

  it('falls back to "Someone" / "your design" when unknown', () => {
    const e = commentNotificationEmail(env, '', 'd1', null);
    expect(e.subject).toMatch(/Someone/);
    expect(e.html).toContain('your design');
  });
});

describe('notifyDesignJoin (docs/specs/014-identity/profile-and-email-notifications.md)', () => {
  it('emails the owner when the per-design claim is won', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.test');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimJoinNotify).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyDesignJoin(env, liveDoc, 'Anna');
    expect(claimJoinNotify).toHaveBeenCalledWith(env, 'd1', expect.any(Number), expect.any(Number));
    const [, now, cutoff] = vi.mocked(claimJoinNotify).mock.calls[0]!.slice(1);
    expect((now as number) - (cutoff as number)).toBe(15 * 60 * 1000);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('stays quiet inside the throttle window', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.test');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimJoinNotify).mockResolvedValue(false);
    await notifyDesignJoin(env, liveDoc, 'Anna');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('spends no claim when the owner opted out', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.test');
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyDesignJoin: false });
    await notifyDesignJoin(env, liveDoc, 'Anna');
    expect(claimJoinNotify).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyNewComment', () => {
  it('does nothing when email is off', async () => {
    await notifyNewComment({} as Env, liveDoc, 'Anna');
    expect(getOwnerEmail).not.toHaveBeenCalled();
  });

  it('sends to the owner when they have an address and have not opted out', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimCommentNotify).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('throttles: no send when a comment email went out recently', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimCommentNotify).mockResolvedValue(false);
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the owner opted out of comment notifications', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyComments: false });
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the owner has no stored address (e.g. a guest)', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue(null);
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(getNotificationPrefs).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('actionAssignedEmail (docs/specs/012-collaboration/assigned-actions.md)', () => {
  it('names the assigner, design, and action, links to the design', () => {
    const e = actionAssignedEmail(
      env,
      'Sam',
      { id: 'd1', name: 'Roadmap' },
      'Review the copy',
      'Hero only',
    );
    expect(e.subject).toMatch(/Sam/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('Review the copy');
    expect(e.html).toContain('Hero only');
    expect(e.html).toContain('https://app.test/design/d1');
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });

  it('escapes user-influenced strings and truncates a long description', () => {
    const e = actionAssignedEmail(
      env,
      '<b>x</b>',
      { id: 'd1', name: 'Roadmap' },
      '<script>',
      'y'.repeat(500),
    );
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).not.toContain('<b>x</b>');
    expect(e.html).not.toContain('y'.repeat(201));
    expect(e.html).toContain(`${'y'.repeat(200)}…`);
  });

  it('falls back when the assigner or design name is unknown', () => {
    const e = actionAssignedEmail(env, null, { id: 'd1', name: '' }, 'Do it', null);
    expect(e.subject).toMatch(/A teammate/);
    expect(e.html).toContain('a shared design');
  });

  it('names no design, and links to none, for an assignee who cannot open it', () => {
    const e = actionAssignedEmail(env, 'Sam', null, 'Review the copy', null);
    expect(e.html).toContain('Review the copy');
    expect(e.html).toContain('ask them to share it');
    expect(e.html).not.toContain('/design/');
    expect(e.html).toContain('https://app.test/explorer');
  });
});

describe('notifyActionAssigned (docs/specs/012-collaboration/assigned-actions.md)', () => {
  const input = {
    assigneeUserId: 'u2',
    assigneeFallbackEmail: 'invited@x.com',
    assignerUserId: 'u1',
    assignerName: 'Sam',
    design: { id: 'd1', name: 'Roadmap' },
    assigneeCanOpen: true,
    actionName: 'Review the copy',
    description: null,
  };
  beforeEach(() => vi.mocked(claimNotifyEmail).mockResolvedValue(true));

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

  it('claims each email against the assigner, keyed on what it says and to whom', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('assignee@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyActionAssigned(env, input);
    await notifyActionAssigned(env, input);
    await notifyActionAssigned(env, { ...input, actionName: 'Something else' });
    const claims = vi.mocked(claimNotifyEmail).mock.calls.map((c) => c[1]);
    expect(claims.map((c) => c.senderId)).toEqual(['u1', 'u1', 'u1']);
    expect(claims[0]!.key).toMatch(/^[0-9a-f]{64}$/);
    expect(claims[1]!.key).toBe(claims[0]!.key);
    expect(claims[2]!.key).not.toBe(claims[0]!.key);
    expect(claims[0]!.rateMax).toBe(NOTIFY_EMAILS_PER_SENDER_PER_HOUR);
    expect(claims[0]!.now - claims[0]!.dedupeSince).toBe(NOTIFY_EMAIL_DEDUPE_MS);
  });

  it('sends nothing when the claim is refused (a duplicate, or the assigner is over the cap)', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('assignee@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimNotifyEmail).mockResolvedValue(false);
    await notifyActionAssigned(env, input);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('leaves the design out for an assignee who cannot open it', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('assignee@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyActionAssigned(env, { ...input, assigneeCanOpen: false });
    const html = vi.mocked(sendEmail).mock.calls[0]![1].html;
    expect(html).not.toContain('Roadmap');
    expect(html).not.toContain('/design/d1');
  });
});

describe('notifyMentioned (docs/specs/012-collaboration/comment-mentions.md)', () => {
  const input = {
    recipientUserId: 'u2',
    recipientFallbackEmail: 'invited@x.com',
    authorUserId: 'u1',
    authorName: 'Sam',
    design: { id: 'd1', name: 'Roadmap' },
    commentText: 'Can you check this, @priya?',
  };
  beforeEach(() => vi.mocked(claimNotifyEmail).mockResolvedValue(true));

  it('does nothing when email is off', async () => {
    await notifyMentioned({} as Env, input);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends the quote to the recipient’s verified address when opted in', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('priya@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyMentioned(env, input);
    const sent = vi.mocked(sendEmail).mock.calls[0]![1];
    expect(sent.to).toBe('priya@x.com');
    expect(sent.subject).toBe('Sam mentioned you in Roadmap');
    expect(sent.html).toContain('Can you check this, @priya?');
  });

  it('writes to an invited member at their invite address, with no prefs to read', async () => {
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyMentioned(env, { ...input, recipientUserId: null });
    expect(getNotificationPrefs).not.toHaveBeenCalled();
    expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe('invited@x.com');
  });

  it('skips when the recipient opted out of mention emails', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('priya@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyMentions: false });
    await notifyMentioned(env, input);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends a replayed mention once: the second claim is refused', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('priya@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    vi.mocked(claimNotifyEmail).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await notifyMentioned(env, input);
    await notifyMentioned(env, input);
    expect(sendEmail).toHaveBeenCalledOnce();
    const [first, second] = vi.mocked(claimNotifyEmail).mock.calls.map((c) => c[1]);
    expect(second!.key).toBe(first!.key);
    expect(first!.senderId).toBe('u1');
  });
});

describe('notifyMilestone (docs/specs/014-identity/transactional-email.md #6)', () => {
  it('sends + claims at a milestone count when opted in', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimAccountMilestone).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyMilestone(env, 'u1', 10);
    expect(claimAccountMilestone).toHaveBeenCalledWith(env, 'u1', 'milestone');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('does nothing at a non-milestone count', async () => {
    await notifyMilestone(env, 'u1', 7);
    expect(getOwnerEmail).not.toHaveBeenCalled();
  });

  it('does not send when the claim is lost (a concurrent save already sent)', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimAccountMilestone).mockResolvedValue(false);
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

describe('notifyFirstShare (docs/specs/014-identity/transactional-email.md #6)', () => {
  it('sends + claims on a first share when opted in', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimAccountMilestone).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyFirstShare(env, 'u1');
    expect(claimAccountMilestone).toHaveBeenCalledWith(env, 'u1', 'firstShare');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('does not send when already claimed (not actually the first share)', async () => {
    vi.mocked(getOwnerEmail).mockResolvedValue('owner@x.com');
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(claimAccountMilestone).mockResolvedValue(false);
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

describe('notifyInviteResponse (docs/specs/014-identity/profile-and-email-notifications.md)', () => {
  it('reads every admin’s address in one request and skips the responder', async () => {
    vi.mocked(listTeamAdminUserIds).mockResolvedValue(['u1', 'u2', 'u3']);
    vi.mocked(emailsOf).mockResolvedValue(
      new Map([
        ['u1', 'one@x.test'],
        ['u2', 'two@x.test'],
      ]),
    );
    vi.mocked(getNotificationPrefs).mockResolvedValue(allowAll);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });
    await notifyInviteResponse(env, { id: 't1', name: 'Design' }, 'new@x.test', true, 'u2');
    expect(emailsOf).toHaveBeenCalledOnce();
    expect(emailsOf).toHaveBeenCalledWith(env, ['u1', 'u3']);
    expect(vi.mocked(sendEmail).mock.calls.map((c) => c[1].to)).toEqual(['one@x.test']);
  });

  it('skips an admin who opted out', async () => {
    vi.mocked(listTeamAdminUserIds).mockResolvedValue(['u1']);
    vi.mocked(emailsOf).mockResolvedValue(new Map([['u1', 'one@x.test']]));
    vi.mocked(getNotificationPrefs).mockResolvedValue({ ...allowAll, notifyInviteResponse: false });
    await notifyInviteResponse(env, { id: 't1', name: 'Design' }, 'new@x.test', false, null);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
