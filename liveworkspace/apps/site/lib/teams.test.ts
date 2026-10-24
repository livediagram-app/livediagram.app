import { describe, expect, it } from 'vitest';
import {
  AVATAR_TONES,
  avatarTone,
  INVITES_PATH,
  joinTokenFrom,
  memberCountLabel,
  teamInitials,
  teamPath,
} from './teams';

describe('where teams are', () => {
  it('opens a team, and the invitations, in the Explorer', () => {
    expect(teamPath('abc-123')).toBe('/explorer/team?id=abc-123');
    expect(teamPath('a b')).toBe('/explorer/team?id=a%20b');
    expect(INVITES_PATH).toBe('/explorer/invites');
  });

  it('takes a join token from the address only when it looks like one', () => {
    expect(joinTokenFrom('?token=abc_DEF-123')).toBe('abc_DEF-123');
    expect(joinTokenFrom('?token=uuid-1.secret_2')).toBe('uuid-1.secret_2');
    expect(joinTokenFrom('')).toBeNull();
    expect(joinTokenFrom('?token=<script>')).toBeNull();
  });
});

describe('a team’s tile', () => {
  it('draws initials and counts members', () => {
    expect(teamInitials('northwind design studio')).toBe('ND');
    expect(teamInitials('  ')).toBe('?');
    expect(memberCountLabel(1)).toBe('1 member');
    expect(memberCountLabel(3)).toBe('3 members');
  });

  it('keeps a team in one tone wherever it appears', () => {
    expect(avatarTone('team_1')).toBe(avatarTone('team_1'));
    expect(AVATAR_TONES).toContain(avatarTone('anything'));
  });
});
