// What a Timeline card says for the events about no item (a team's, a token's, images, an item taken offline) and
// for the collaboration events, and where each one opens.
import { describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '@liveworkspace/index-client';
import { makeEvent } from '../test/fakeClient';
import { accountPageUrl, renderTimelineEvent } from './TimelinePane';

const ctx = () => ({
  viewerId: 'user_me',
  filter: 'all' as const,
  renderThumbnail: undefined,
  openItem: vi.fn(),
  navigate: vi.fn(),
  teamName: () => 'Team',
  manageTeamsUrl: '/account/teams',
});

const loose = (type: TimelineEvent['type'], over: Partial<TimelineEvent> = {}): TimelineEvent =>
  ({
    ...makeEvent(1, { type }),
    app: 'liveworkspace',
    item: null,
    itemId: null,
    title: 'Guild',
    actorId: 'user_ana',
    actorName: 'Ana',
    ...over,
  }) as TimelineEvent;

describe('Timeline cards about no item', () => {
  it('says who did what to a team, and opens the team', () => {
    const c = ctx();
    const role = renderTimelineEvent(
      loose('team_role_changed', { detail: { teamId: 't1', personId: 'user_me', role: 'admin' } }),
      c,
    );
    expect([role.subject, role.label, role.meta]).toEqual([
      'Guild',
      'Role Changed',
      'You are now an Admin · by Ana',
    ]);
    role.onClick!();
    expect(c.navigate).toHaveBeenCalledWith({ kind: 'team', id: 't1' });
    expect(role.badge).toBeUndefined();
    const renamed = renderTimelineEvent(
      loose('team_renamed', { detail: { teamId: 't1', from: 'Old' } }),
      c,
    );
    expect(renamed.meta).toBe('Was “Old” · by Ana');
    const invited = renderTimelineEvent(
      loose('team_invite_sent', { detail: { teamId: 't1', personId: 'user_me' } }),
      c,
    );
    expect([invited.label, invited.meta]).toEqual(['Invited to a Team', 'From Ana']);
    const joined = renderTimelineEvent(loose('team_joined', { actorId: 'user_me' }), c);
    expect(joined.label).toBe('Joined a Team');
    const removed = renderTimelineEvent(
      loose('team_member_removed', { detail: { teamId: 't1', personId: 'user_me' } }),
      c,
    );
    expect([removed.label, removed.onClick]).toEqual(['Removed from a Team', undefined]);
    expect(renderTimelineEvent(loose('team_deleted'), c).onClick).toBeUndefined();
  });

  it('sends a token’s card to the tokens page, and warns ahead of its expiry', () => {
    expect(accountPageUrl('/account/teams', 'tokens')).toBe('/account/tokens');
    expect(accountPageUrl(undefined, 'tokens')).toBeUndefined();
    const card = renderTimelineEvent(
      loose('token_expiring', { title: 'CI', actorId: null }),
      ctx(),
    );
    expect([card.subject, card.label, card.meta]).toEqual([
      'CI',
      'API Token Expiring',
      'Rotate it before it lapses to keep connected tools working',
    ]);
    expect(card.onClick).toBeTypeOf('function');
  });

  it('counts images uploaded, and names an item taken offline after it has gone', () => {
    const images = renderTimelineEvent(
      loose('image_uploaded', { app: 'liveplanner', title: '', detail: { count: '3' } }),
      ctx(),
    );
    expect([images.subject, images.label]).toEqual(['3 images', 'Images Uploaded']);
    expect(images.badge).toBeTruthy();
    const off = renderTimelineEvent(
      loose('taken_offline', { app: 'liveplanner', title: 'Roadmap', actorId: 'user_me' }),
      ctx(),
    );
    expect([off.subject, off.label, off.meta]).toEqual([
      'Roadmap',
      'Taken Offline',
      'Kept only in one browser · by you',
    ]);
  });
});

describe('collaboration cards', () => {
  it('quotes the comment and names the action and who it went to', () => {
    const comment = renderTimelineEvent(
      makeEvent(1, {
        type: 'commented',
        actorId: 'user_ana',
        actorName: 'Ana',
        detail: { text: 'Nice', count: '2' },
      }),
      ctx(),
    );
    expect([comment.label, comment.description, comment.meta]).toEqual([
      'Comment Added',
      'Nice',
      '2 comments · by Ana',
    ]);
    const assigned = renderTimelineEvent(
      makeEvent(1, {
        type: 'action_assigned',
        actorId: 'user_ana',
        actorName: 'Ana',
        detail: { action: 'Ship it', assigneeId: 'user_me', assigneeName: 'Me' },
      }),
      ctx(),
    );
    expect([assigned.description, assigned.meta]).toEqual(['Ship it', 'To you · by Ana']);
  });
});

describe('share link cards', () => {
  it('warns ahead of a share link lapsing, and opens the item to extend it', () => {
    const c = ctx();
    const expiresAt = Date.UTC(2026, 10, 3, 12);
    const one = renderTimelineEvent(
      makeEvent(1, {
        type: 'share_link_expiring',
        actorId: null,
        occurredAt: expiresAt,
        detail: { expiresAt: String(expiresAt), links: '1' },
      }),
      c,
    );
    const date = new Date(expiresAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    expect([one.label, one.meta]).toEqual([
      'Share Link Expiring',
      `A share link stops working on ${date} · Extend it in Share`,
    ]);
    one.onClick!();
    expect(c.openItem).toHaveBeenCalled();
    const two = renderTimelineEvent(
      makeEvent(1, {
        type: 'share_link_expiring',
        detail: { expiresAt: String(expiresAt), links: '2' },
      }),
      ctx(),
    );
    expect(two.meta).toBe(`2 share links stop working on ${date} · Extend it in Share`);
  });
});
