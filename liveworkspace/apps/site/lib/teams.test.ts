import { describe, expect, it } from 'vitest';
import type { Member } from './account-api';
import {
  AVATAR_TONES,
  avatarTone,
  joinTokenFrom,
  lastAdmin,
  memberInitials,
  memberLabel,
  nameFromEmail,
  splitMembers,
  teamAbilities,
  teamIdFromPath,
  teamInitials,
  teamPath,
} from './teams';

const member = (over: Partial<Member>): Member => ({
  id: 'm',
  userId: null,
  email: 'someone@example.com',
  name: null,
  role: 'member',
  status: 'joined',
  expired: false,
  createdAt: 0,
  ...over,
});

describe('team addresses', () => {
  it('reads a team id back from its page', () => {
    expect(teamIdFromPath(teamPath('abc-123'))).toBe('abc-123');
    expect(teamIdFromPath('/account/teams/abc/')).toBe('abc');
    expect(teamIdFromPath(teamPath('a b'))).toBe('a b');
  });

  it('names no team on the list, the placeholder, or anything else', () => {
    expect(teamIdFromPath('/account/teams')).toBeNull();
    expect(teamIdFromPath('/account/teams/team')).toBeNull();
    expect(teamIdFromPath('/account/teams/a/b')).toBeNull();
    expect(teamIdFromPath('/account/teams/%E0%A4%A')).toBeNull();
  });

  it('takes a join token from the address only when it looks like one', () => {
    expect(joinTokenFrom('?token=abc_DEF-123')).toBe('abc_DEF-123');
    expect(joinTokenFrom('?token=uuid-1.secret_2')).toBe('uuid-1.secret_2');
    expect(joinTokenFrom('')).toBeNull();
    expect(joinTokenFrom('?token=<script>')).toBeNull();
  });
});

describe('names and initials', () => {
  it('reads an invited address as a name', () => {
    expect(nameFromEmail('anna.smith@example.com')).toBe('Anna Smith');
    expect(nameFromEmail('jo_b+teams@example.com')).toBe('Jo B');
    expect(memberLabel(member({ name: 'Wendy Tran' }))).toBe('Wendy Tran');
    expect(memberLabel(member({ email: 'anna.smith@example.com' }))).toBe('Anna Smith');
  });

  it('draws initials from the same name', () => {
    expect(memberInitials(member({ name: 'Wendy Tran' }))).toBe('WT');
    expect(memberInitials(member({ email: 'jane.doe@example.com' }))).toBe('JD');
    expect(teamInitials('northwind design studio')).toBe('ND');
    expect(teamInitials('  ')).toBe('?');
  });

  it('keeps a person in one tone wherever they appear', () => {
    expect(avatarTone('user_1')).toBe(avatarTone('user_1'));
    expect(AVATAR_TONES).toContain(avatarTone('anything'));
  });
});

describe('the member list', () => {
  it('puts admins first, then waiting invitations oldest first, then the answers', () => {
    const { joined, invited, declined } = splitMembers([
      member({ id: 'b', name: 'Bea' }),
      member({ id: 'z', name: 'Zed', role: 'admin' }),
      member({ id: 'i2', status: 'invited', createdAt: 2 }),
      member({ id: 'i1', status: 'invited', createdAt: 1 }),
      member({ id: 'd', status: 'declined', expired: true }),
    ]);
    expect(joined.map((m) => m.id)).toEqual(['z', 'b']);
    expect(invited.map((m) => m.id)).toEqual(['i1', 'i2']);
    expect(declined.map((m) => m.id)).toEqual(['d']);
  });

  it('keeps the last admin in: no stepping down, and no leaving while others remain', () => {
    const me = member({ id: 'me', role: 'admin' });
    const other = member({ id: 'o' });
    expect(lastAdmin([me, other], 'me')).toEqual({
      onlyAdmin: true,
      alone: false,
      canLeave: false,
    });
    expect(lastAdmin([me], 'me')).toMatchObject({ alone: true, canLeave: true });
    expect(lastAdmin([me, member({ id: 'o', role: 'admin' })], 'me')).toMatchObject({
      onlyAdmin: false,
      canLeave: true,
    });
    expect(lastAdmin([me, other], 'o')).toMatchObject({ onlyAdmin: false, canLeave: true });
  });

  it('gives admins the running of the team, and everyone leaving', () => {
    expect(teamAbilities('admin')).toEqual({
      rename: true,
      invite: true,
      link: true,
      manage: true,
      delete: true,
      leave: true,
    });
    expect(teamAbilities('member')).toEqual({
      rename: false,
      invite: false,
      link: false,
      manage: false,
      delete: false,
      leave: true,
    });
  });
});
