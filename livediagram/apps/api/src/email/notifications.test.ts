import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEnv } from '../types';

// Who gets an email (a verified address with the switch not off) and how many canvases someone has made are
// liveworkspace's (liveworkspace/notify.ts, tested on its own); the milestone claims are accounts'. The join, action
// and mention emails are @liveworkspace/index-app's createNotifier, tested there.
vi.mock('../liveworkspace/notify', () => ({ notifyRecipients: vi.fn(), canvasesMadeBy: vi.fn() }));
vi.mock('../liveworkspace/emails', () => ({ claimMilestone: vi.fn() }));
vi.mock('../document-room/document-content', () => ({ claimCommentNotify: vi.fn() }));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  sendEmail: vi.fn(),
}));

import { claimCommentNotify } from '../document-room/document-content';
import { claimMilestone } from '../liveworkspace/emails';
import { canvasesMadeBy, notifyRecipients } from '../liveworkspace/notify';
import { sendEmail } from './client';
import { actionAssignedEmail, commentNotificationEmail } from './templates';
import { notifyFirstShare, notifyMilestone, notifyNewComment } from './notifications';

const env = {
  EMAIL: { send: vi.fn(async () => ({ messageId: 'm' })) },
  APP_BASE_URL: 'https://app.test',
} as unknown as DocumentEnv;
const liveDoc = { id: 'd1', ownerId: 'user_u1', name: 'Roadmap' };

// These accounts have a verified address and the switch on; anyone else gets nothing (opted out, or no address).
function reachable(addresses: Record<string, string>) {
  vi.mocked(notifyRecipients).mockImplementation(
    async (_env, ids) =>
      new Map(ids.flatMap((id) => (addresses[id] ? [[id, addresses[id]] as const] : []))),
  );
}

beforeEach(() => {
  vi.mocked(sendEmail).mockResolvedValue({ sent: true });
  vi.mocked(notifyRecipients).mockResolvedValue(new Map());
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
