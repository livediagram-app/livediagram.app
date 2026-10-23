import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  JOIN_NOTIFY_THROTTLE_MS,
  NOTIFY_EMAIL_DEDUPE_MS,
  NOTIFY_EMAILS_PER_SENDER_PER_HOUR,
  type TeamPerson,
} from '@liveworkspace/auth-client';
import type { DocumentEnv } from '../types';

// Who gets an email (a verified address with the switch not off) and how many canvases someone has made are
// liveworkspace's (liveworkspace/notify.ts, tested on its own); the once-only claims are the canvas's own
// (@liveworkspace/index-app notify-claims.ts) or accounts' (the milestones).
vi.mock('../liveworkspace/notify', () => ({ notifyRecipients: vi.fn(), canvasesMadeBy: vi.fn() }));
vi.mock('../liveworkspace/emails', () => ({ claimMilestone: vi.fn() }));
vi.mock('../liveworkspace/profiles', () => ({ getParticipant: vi.fn() }));
vi.mock('../document-room/document-content', () => ({ claimCommentNotify: vi.fn() }));
vi.mock('@liveworkspace/index-app', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/index-app')>()),
  claimNotice: vi.fn(),
  claimNotices: vi.fn(),
  workbenchAllowance: () => null,
}));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import { claimNotice, claimNotices } from '@liveworkspace/index-app';
import { claimCommentNotify } from '../document-room/document-content';
import { claimMilestone } from '../liveworkspace/emails';
import { canvasesMadeBy, notifyRecipients } from '../liveworkspace/notify';
import { getParticipant } from '../liveworkspace/profiles';
import { sendEmail } from './client';
import { actionAssignedEmail, commentNotificationEmail } from './templates';
import {
  notifyActionAssigned,
  notifyDocumentJoin,
  notifyFirstShare,
  notifyMentioned,
  notifyMilestone,
  notifyNewComment,
} from './notifications';

const env = { RESEND_API_KEY: 're', APP_BASE_URL: 'https://app.test' } as unknown as DocumentEnv;
const liveDoc = { id: 'd1', ownerId: 'user_u1', name: 'Roadmap' };

// These accounts have a verified address and the switch on; anyone else gets nothing (opted out, or no address).
function reachable(addresses: Record<string, string>) {
  vi.mocked(notifyRecipients).mockImplementation(
    async (_env, ids) =>
      new Map(ids.flatMap((id) => (addresses[id] ? [[id, addresses[id]] as const] : []))),
  );
}

type Claim = {
  key: string;
  sender: string;
  now: number;
  dedupeSince: number;
  rate?: { max: number };
};
const claimed = () => vi.mocked(claimNotices).mock.calls.flatMap((c) => c[1] as Claim[]);

beforeEach(() => {
  vi.mocked(sendEmail).mockResolvedValue({ sent: true });
  vi.mocked(notifyRecipients).mockResolvedValue(new Map());
  vi.mocked(claimNotices).mockImplementation(async (_db, claims) => claims.map(() => true));
});
afterEach(() => vi.resetAllMocks());

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

describe('notifyDocumentJoin (docs/specs/014-identity/profile-and-email-notifications.md)', () => {
  it('emails the owner when the per-canvas claim is won, naming the joiner', async () => {
    reachable({ user_u1: 'owner@x.test' });
    vi.mocked(claimNotice).mockResolvedValue(true);
    vi.mocked(getParticipant).mockResolvedValue({ name: 'Anna' } as never);
    await notifyDocumentJoin(env, liveDoc, 'user_anna');
    expect(notifyRecipients).toHaveBeenCalledWith(env, ['user_u1'], 'notifyDocumentJoin');
    const [, claim] = vi.mocked(claimNotice).mock.calls[0]!;
    expect(claim).toMatchObject({ key: 'join', sender: 'user_u1' });
    expect(claim.now - claim.dedupeSince).toBe(JOIN_NOTIFY_THROTTLE_MS);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe('owner@x.test');
    expect(vi.mocked(sendEmail).mock.calls[0]![1].html).toContain('Anna');
  });

  it('stays quiet inside the throttle window', async () => {
    reachable({ user_u1: 'owner@x.test' });
    vi.mocked(claimNotice).mockResolvedValue(false);
    await notifyDocumentJoin(env, liveDoc, 'user_anna');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('spends no claim when the owner opted out', async () => {
    await notifyDocumentJoin(env, liveDoc, 'user_anna');
    expect(claimNotice).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('never writes for a guest joiner, or for the owner opening their own canvas', async () => {
    reachable({ user_u1: 'owner@x.test' });
    vi.mocked(claimNotice).mockResolvedValue(true);
    await notifyDocumentJoin(env, liveDoc, '0f5ca4af-9a8a-4a60-be5e-1179e5555880');
    await notifyDocumentJoin(env, liveDoc, 'user_u1');
    expect(notifyRecipients).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyNewComment', () => {
  it('does nothing when email is off', async () => {
    await notifyNewComment({} as DocumentEnv, liveDoc, 'Anna');
    expect(notifyRecipients).not.toHaveBeenCalled();
  });

  it('sends to the owner when they have an address and have not opted out', async () => {
    reachable({ user_u1: 'owner@x.com' });
    vi.mocked(claimCommentNotify).mockResolvedValue(true);
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(notifyRecipients).toHaveBeenCalledWith(env, ['user_u1'], 'notifyComments');
    expect(sendEmail).toHaveBeenCalledOnce();
    const [, documentId, now, cutoff] = vi.mocked(claimCommentNotify).mock.calls[0]!;
    expect(documentId).toBe('d1');
    expect(now - cutoff).toBe(15 * 60 * 1000);
  });

  it('throttles: no send when a comment email went out recently', async () => {
    reachable({ user_u1: 'owner@x.com' });
    vi.mocked(claimCommentNotify).mockResolvedValue(false);
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips, spending no claim, when the owner opted out or has no address', async () => {
    await notifyNewComment(env, liveDoc, 'Anna');
    expect(claimCommentNotify).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips a guest-owned canvas without asking', async () => {
    await notifyNewComment(env, { ...liveDoc, ownerId: 'guest-1' }, 'Anna');
    expect(notifyRecipients).not.toHaveBeenCalled();
  });
});

describe('actionAssignedEmail (docs/specs/012-collaboration/assigned-actions.md)', () => {
  it('names the assigner, document, and action, links to the document', () => {
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
    expect(e.html).toContain('https://app.test/document/d1');
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

  it('falls back when the assigner or document name is unknown', () => {
    const e = actionAssignedEmail(env, null, { id: 'd1', name: '' }, 'Do it', null);
    expect(e.subject).toMatch(/A teammate/);
    expect(e.html).toContain('a shared document');
  });

  it('names no document, and links to none, for an assignee who cannot open it', () => {
    const e = actionAssignedEmail(env, 'Sam', null, 'Review the copy', null);
    expect(e.html).toContain('Review the copy');
    expect(e.html).toContain('ask them to share it');
    expect(e.html).not.toContain('/document/');
    expect(e.html).toContain('https://app.test/explorer');
  });
});

describe('notifyActionAssigned (docs/specs/012-collaboration/assigned-actions.md)', () => {
  const assignee: TeamPerson = {
    id: 'm-2',
    userId: 'user_u2',
    email: 'invited@x.com',
    name: null,
    role: 'member',
    status: 'joined',
  };
  const input = {
    assignee,
    assignerUserId: 'user_u1',
    assignerName: 'Sam',
    document: { id: 'd1', name: 'Roadmap' },
    assigneeCanOpen: true,
    actionName: 'Review the copy',
    description: null,
  };

  it('does nothing when email is off', async () => {
    await notifyActionAssigned({} as DocumentEnv, input);
    expect(notifyRecipients).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends to the assignee’s verified address when opted in', async () => {
    reachable({ user_u2: 'assignee@x.com' });
    await notifyActionAssigned(env, input);
    expect(notifyRecipients).toHaveBeenCalledWith(env, ['user_u2'], 'notifyActionAssigned');
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe('assignee@x.com');
  });

  it('writes to an invited person at their invite address, with no switch to read', async () => {
    await notifyActionAssigned(env, {
      ...input,
      assignee: { ...assignee, userId: null, status: 'invited' },
    });
    expect(notifyRecipients).not.toHaveBeenCalled();
    expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe('invited@x.com');
  });

  it('skips an account that opted out (or has no verified address): never its invite address', async () => {
    await notifyActionAssigned(env, input);
    expect(claimNotices).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('claims each email against the assigner, keyed on what it says and to whom', async () => {
    reachable({ user_u2: 'assignee@x.com' });
    await notifyActionAssigned(env, input);
    await notifyActionAssigned(env, input);
    await notifyActionAssigned(env, { ...input, actionName: 'Something else' });
    const claims = claimed();
    expect(claims.map((c) => c.sender)).toEqual(['user_u1', 'user_u1', 'user_u1']);
    expect(claims[0]!.key).toMatch(/^[0-9a-f]{64}$/);
    expect(claims[1]!.key).toBe(claims[0]!.key);
    expect(claims[2]!.key).not.toBe(claims[0]!.key);
    expect(claims[0]!.rate?.max).toBe(NOTIFY_EMAILS_PER_SENDER_PER_HOUR);
    expect(claims[0]!.now - claims[0]!.dedupeSince).toBe(NOTIFY_EMAIL_DEDUPE_MS);
    // In the canvas's own store.
    expect(vi.mocked(claimNotices).mock.calls[0]![0]).toBe(env.DOCUMENT_DB);
  });

  it('sends nothing when the claim is refused (a duplicate, or the assigner is over the cap)', async () => {
    reachable({ user_u2: 'assignee@x.com' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(claimNotices).mockResolvedValue([false]);
    await notifyActionAssigned(env, input);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('leaves the document out for an assignee who cannot open it', async () => {
    reachable({ user_u2: 'assignee@x.com' });
    await notifyActionAssigned(env, { ...input, assigneeCanOpen: false });
    const html = vi.mocked(sendEmail).mock.calls[0]![1].html;
    expect(html).not.toContain('Roadmap');
    expect(html).not.toContain('/document/d1');
  });
});

describe('notifyMentioned (docs/specs/012-collaboration/comment-mentions.md)', () => {
  const priya: TeamPerson = {
    id: 'm-2',
    userId: 'user_priya',
    email: 'priya-invite@x.com',
    name: null,
    role: 'member',
    status: 'joined',
  };
  const invited: TeamPerson = {
    id: 'm-3',
    userId: null,
    email: 'invited@x.com',
    name: null,
    role: 'member',
    status: 'invited',
  };
  const input = {
    recipients: [priya],
    authorUserId: 'user_u1',
    authorName: 'Sam',
    document: { id: 'd1', name: 'Roadmap' },
    commentText: 'Can you check this, @priya?',
  };

  it('does nothing when email is off, or for no one', async () => {
    await notifyMentioned({} as DocumentEnv, input);
    await notifyMentioned(env, { ...input, recipients: [] });
    expect(notifyRecipients).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends the quote to the recipient’s verified address when opted in', async () => {
    reachable({ user_priya: 'priya@x.com' });
    await notifyMentioned(env, input);
    expect(notifyRecipients).toHaveBeenCalledWith(env, ['user_priya'], 'notifyMentions');
    const sent = vi.mocked(sendEmail).mock.calls[0]![1];
    expect(sent.to).toBe('priya@x.com');
    expect(sent.subject).toBe('Sam mentioned you in Roadmap');
    expect(sent.html).toContain('Can you check this, @priya?');
  });

  it('writes to an invited member at their invite address, with no switch to read', async () => {
    await notifyMentioned(env, { ...input, recipients: [invited] });
    expect(notifyRecipients).not.toHaveBeenCalled();
    expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe('invited@x.com');
  });

  it('skips when the recipient opted out of mention emails', async () => {
    await notifyMentioned(env, input);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('asks once and claims once for everyone mentioned, sending only what was allowed', async () => {
    reachable({ user_priya: 'priya@x.com' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(claimNotices).mockResolvedValue([true, false]);
    await notifyMentioned(env, { ...input, recipients: [priya, invited] });
    expect(notifyRecipients).toHaveBeenCalledOnce();
    expect(claimNotices).toHaveBeenCalledOnce();
    expect(vi.mocked(sendEmail).mock.calls.map((c) => c[1].to)).toEqual(['priya@x.com']);
  });

  it('sends a replayed mention once: the second claim is refused', async () => {
    reachable({ user_priya: 'priya@x.com' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(claimNotices).mockResolvedValueOnce([true]).mockResolvedValueOnce([false]);
    await notifyMentioned(env, input);
    await notifyMentioned(env, input);
    expect(sendEmail).toHaveBeenCalledOnce();
    const [first, second] = claimed();
    expect(second!.key).toBe(first!.key);
    expect(first!.sender).toBe('user_u1');
  });
});

describe('notifyMilestone (docs/specs/014-identity/transactional-email.md #6)', () => {
  it('sends + claims at a milestone count when opted in', async () => {
    vi.mocked(canvasesMadeBy).mockResolvedValue(10);
    reachable({ user_u1: 'owner@x.com' });
    vi.mocked(claimMilestone).mockResolvedValue(true);
    await notifyMilestone(env, 'user_u1');
    expect(notifyRecipients).toHaveBeenCalledWith(env, ['user_u1'], 'notifyMilestones');
    expect(claimMilestone).toHaveBeenCalledWith(env, 'user_u1', 'milestone');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('does nothing at a non-milestone count, or when the index cannot be asked', async () => {
    vi.mocked(canvasesMadeBy).mockResolvedValueOnce(7).mockResolvedValueOnce(null);
    await notifyMilestone(env, 'user_u1');
    await notifyMilestone(env, 'user_u1');
    expect(notifyRecipients).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('never counts for a guest', async () => {
    await notifyMilestone(env, 'guest-1');
    expect(canvasesMadeBy).not.toHaveBeenCalled();
  });

  it('does not send when the claim is lost (a concurrent create already sent)', async () => {
    vi.mocked(canvasesMadeBy).mockResolvedValue(10);
    reachable({ user_u1: 'owner@x.com' });
    vi.mocked(claimMilestone).mockResolvedValue(false);
    await notifyMilestone(env, 'user_u1');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips, spending no claim, when the owner opted out of milestones', async () => {
    vi.mocked(canvasesMadeBy).mockResolvedValue(10);
    await notifyMilestone(env, 'user_u1');
    expect(claimMilestone).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyFirstShare (docs/specs/014-identity/transactional-email.md #6)', () => {
  it('sends + claims on a first share when opted in', async () => {
    reachable({ user_u1: 'owner@x.com' });
    vi.mocked(claimMilestone).mockResolvedValue(true);
    await notifyFirstShare(env, 'user_u1');
    expect(claimMilestone).toHaveBeenCalledWith(env, 'user_u1', 'firstShare');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('does not send when already claimed (not actually the first share)', async () => {
    reachable({ user_u1: 'owner@x.com' });
    vi.mocked(claimMilestone).mockResolvedValue(false);
    await notifyFirstShare(env, 'user_u1');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when the owner opted out of milestones', async () => {
    await notifyFirstShare(env, 'user_u1');
    expect(claimMilestone).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
