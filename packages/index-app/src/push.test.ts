import { describe, expect, it, vi } from 'vitest';
import type { PushNotification, TeamPerson } from '@liveworkspace/auth-client';
import {
  createPusher,
  pushTitle,
  PUSH_RECIPIENTS_MAX,
  roomPersonTag,
  type PusherDeps,
} from './push';

type Env = { ROOM_PEOPLE?: () => ReadonlySet<string> };

const person = (userId: string | null, status: 'joined' | 'invited' = 'joined'): TeamPerson => ({
  id: `m_${userId ?? 'inv'}`,
  userId,
  email: `${userId}@x.test`,
  name: userId,
  role: 'member',
  status,
});

const TEAM = [
  person('user_ada'),
  person('user_bea'),
  person('user_cy'),
  person(null, 'invited'),
  person('user_dee', 'invited'),
];

function setup(opts: { team?: TeamPerson[] | null; grants?: string[]; teamFails?: boolean } = {}) {
  const sent: PushNotification[] = [];
  const indexAsks: string[] = [];
  const deps: PusherDeps<Env> = {
    send: async (_env, notifications) => void sent.push(...notifications),
    isAccount: (id) => id.startsWith('user_'),
    teamPeople: async () => {
      if (opts.teamFails) throw new Error('down');
      return opts.team === undefined ? TEAM : opts.team;
    },
    indexGrants: async (_env, _item, id) => {
      indexAsks.push(id);
      if (id === 'user_boom') throw new Error('index down');
      return (opts.grants ?? []).includes(id);
    },
  };
  return { pusher: createPusher(deps), sent, indexAsks };
}

const item = { id: 'doc1', name: 'Roadmap', ownerId: 'user_own', teamId: 'team1' };
const base = {
  item,
  authorId: 'user_ada',
  authorName: 'Ada',
  threadAuthorIds: [] as string[],
  mentionsMax: 20,
  url: 'https://www.livediagram.app/document/doc1#el=e1&open=comments',
  tag: 'doc1:e1',
};

describe('pushTitle', () => {
  it('names who and the item, never what they wrote', () => {
    expect(pushTitle('mention', 'Ada', 'Roadmap')).toBe('Ada mentioned you in Roadmap');
    expect(pushTitle('threadReply', ' ', 'Roadmap')).toBe('Someone replied in Roadmap');
    expect(pushTitle('comment', null, '')).toBe('Someone commented on Untitled');
    expect(pushTitle('action', 'Bea', 'Q3')).toBe('Bea assigned you an action in Q3');
  });
});

describe('pushComment', () => {
  it('picks one kind per person: a mention, then a reply in their thread, then a comment on what they own', async () => {
    const { pusher, sent } = setup({ grants: ['user_own'] });
    await pusher.pushComment(
      {},
      {
        ...base,
        item: { ...item, ownerId: 'user_cy' },
        mentions: [{ userId: 'user_bea' }, { memberId: 'm_user_cy' }, { userId: 'user_stranger' }],
        threadAuthorIds: ['user_bea', 'user_cy', 'user_ada', 'guest_x'],
      },
    );
    expect(sent).toEqual([
      {
        userId: 'user_bea',
        kind: 'mention',
        title: 'Ada mentioned you in Roadmap',
        url: base.url,
        tag: base.tag,
      },
      {
        userId: 'user_cy',
        kind: 'mention',
        title: 'Ada mentioned you in Roadmap',
        url: base.url,
        tag: base.tag,
      },
    ]);
  });

  it('sends a reply to earlier writers and a comment to the owner, only those who can read it', async () => {
    const { pusher, sent, indexAsks } = setup({ grants: ['user_link'] });
    await pusher.pushComment(
      {},
      {
        ...base,
        threadAuthorIds: ['user_bea', 'user_link', 'user_gone', 'user_dee'],
      },
    );
    expect(sent.map((n) => [n.userId, n.kind])).toEqual([
      ['user_bea', 'threadReply'],
      ['user_link', 'threadReply'],
      ['user_own', 'comment'],
    ]);
    // The owner and team members need no index ask; an invited person isn't one of its readers until they join.
    expect(indexAsks).toEqual(['user_link', 'user_gone', 'user_dee']);
  });

  it('never reaches someone already looking at the item', async () => {
    const { pusher, sent } = setup({ grants: ['user_own'] });
    const tag = await roomPersonTag('doc1', 'user_bea');
    await pusher.pushComment(
      { ROOM_PEOPLE: () => new Set([tag]) },
      { ...base, threadAuthorIds: ['user_bea'] },
    );
    expect(sent.map((n) => n.userId)).toEqual(['user_own']);
    sent.length = 0;
    const own = await roomPersonTag('doc1', 'user_own');
    await pusher.pushComment(
      { ROOM_PEOPLE: () => new Set([tag, own]) },
      { ...base, threadAuthorIds: ['user_bea'] },
    );
    expect(sent).toEqual([]);
    await pusher.pushComment(
      { ROOM_PEOPLE: () => new Set() },
      { ...base, threadAuthorIds: ['user_bea'] },
    );
    expect(sent.map((n) => n.userId)).toEqual(['user_bea', 'user_own']);
  });

  it('takes no mention from someone outside the team, and none on an item with no team', async () => {
    const outsider = setup({ grants: ['user_own'] });
    await outsider.pusher.pushComment(
      {},
      { ...base, authorId: 'user_out', mentions: [{ userId: 'user_bea' }] },
    );
    expect(outsider.sent.map((n) => [n.userId, n.kind])).toEqual([['user_own', 'comment']]);
    const solo = setup({ grants: ['user_own'] });
    await solo.pusher.pushComment(
      {},
      { ...base, item: { ...item, teamId: null }, mentions: [{ userId: 'user_bea' }] },
    );
    expect(solo.sent.map((n) => n.userId)).toEqual(['user_own']);
  });

  it('sends nothing for a guest author, to the author, or when nobody is left', async () => {
    const { pusher, sent } = setup();
    await pusher.pushComment({}, { ...base, authorId: 'guest_x' });
    await pusher.pushComment({}, { ...base, authorId: 'user_own' });
    expect(sent).toEqual([]);
  });

  it('caps the people one event reaches, and never throws', async () => {
    const many = Array.from({ length: PUSH_RECIPIENTS_MAX + 10 }, (_, i) => `user_${i}`);
    const { pusher, sent } = setup({ team: many.map((id) => person(id)) });
    await pusher.pushComment(
      {},
      { ...base, item: { ...item, ownerId: 'user_0' }, threadAuthorIds: many },
    );
    expect(sent).toHaveLength(PUSH_RECIPIENTS_MAX);
    const failing = setup({ teamFails: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(failing.pusher.pushComment({}, base)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('counts an index that fails as no access', async () => {
    const { pusher, sent } = setup({ team: null, grants: ['user_own'] });
    await pusher.pushComment({}, { ...base, threadAuthorIds: ['user_boom'] });
    expect(sent.map((n) => n.userId)).toEqual(['user_own']);
  });
});

describe('pushActionAssigned', () => {
  const action = {
    item,
    assignerId: 'user_ada',
    assignerName: 'Ada',
    assigneeUserId: 'user_bea' as string | null,
    url: 'https://www.liveplanner.app/project/doc1#t=t1&el=e1&open=action',
    tag: 'doc1:action:e1',
  };

  it('reaches the assignee who can read the item', async () => {
    const { pusher, sent } = setup();
    await pusher.pushActionAssigned({}, action);
    expect(sent).toEqual([
      {
        userId: 'user_bea',
        kind: 'action',
        title: 'Ada assigned you an action in Roadmap',
        url: action.url,
        tag: action.tag,
      },
    ]);
  });

  it('sends nothing to someone with no account, the assigner, a guest assigner, or someone who cannot read it', async () => {
    const { pusher, sent } = setup({ team: [] });
    await pusher.pushActionAssigned({}, { ...action, assigneeUserId: null });
    await pusher.pushActionAssigned({}, { ...action, assigneeUserId: 'user_ada' });
    await pusher.pushActionAssigned({}, { ...action, assignerId: 'guest_x' });
    await pusher.pushActionAssigned({}, action);
    await pusher.pushActionAssigned({}, { ...action, item: { ...item, teamId: null } });
    expect(sent).toEqual([]);
  });

  it('never throws', async () => {
    const { pusher } = setup({ teamFails: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(pusher.pushActionAssigned({}, action)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
