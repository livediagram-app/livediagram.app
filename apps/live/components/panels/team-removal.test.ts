// Removing a row from a team's member list (spec/32 + spec/22).
//
// The list mixes joined members with invitations nobody has accepted, behind one
// Remove control. These cases pin the three-way split, because collapsing it is
// what went wrong: a withdrawn invitation was counted as a member leaving, and
// told the admin that someone who had never joined would be "removed from" the
// team.
import { describe, expect, it } from 'vitest';
import { teamRemovalCopy, teamRemovalKind, teamRemovalTelemetryType } from './team-removal';

describe('teamRemovalKind', () => {
  it('calls a joined member a member', () => {
    expect(teamRemovalKind(false, 'joined')).toBe('member');
  });

  it('calls an unaccepted invitation an invite', () => {
    expect(teamRemovalKind(false, 'invited')).toBe('invite');
  });

  it('calls the user acting on their own row leaving, whatever the status', () => {
    expect(teamRemovalKind(true, 'joined')).toBe('self');
    expect(teamRemovalKind(true, 'invited')).toBe('self');
  });
});

describe('teamRemovalTelemetryType', () => {
  it('reports a withdrawn invitation as Invite, not as a member removal', () => {
    expect(teamRemovalTelemetryType('invite')).toBe('Invite');
    expect(teamRemovalTelemetryType('member')).toBe('Member');
    expect(teamRemovalTelemetryType('self')).toBe('Self');
  });

  it('gives every kind a distinct type, so the buckets stay readable', () => {
    const kinds = ['self', 'invite', 'member'] as const;
    const types = kinds.map(teamRemovalTelemetryType);
    expect(new Set(types).size).toBe(kinds.length);
  });
});

describe('teamRemovalCopy', () => {
  const args = { memberLabel: 'sam', teamName: 'Design' };

  it('asks to withdraw an invitation, and says the person has not joined', () => {
    const copy = teamRemovalCopy('invite', args);
    expect(copy.title).toBe('Withdraw invite?');
    expect(copy.confirmLabel).toBe('Withdraw');
    expect(copy.message).toContain('has not joined');
    expect(copy.failureNotice).toContain('withdraw');
  });

  it('never describes a pending invitee as being removed from the team', () => {
    const copy = teamRemovalCopy('invite', args);
    expect(copy.message).not.toContain('removed from');
    expect(copy.title).not.toContain('member');
  });

  it('asks to remove a member who did join', () => {
    const copy = teamRemovalCopy('member', args);
    expect(copy.title).toBe('Remove member?');
    expect(copy.message).toBe('sam will be removed from "Design".');
    expect(copy.confirmLabel).toBe('Remove');
  });

  it('addresses the user directly when they are leaving, ignoring the label', () => {
    const copy = teamRemovalCopy('self', { memberLabel: null, teamName: 'Design' });
    expect(copy.title).toBe('Leave team?');
    expect(copy.message).toBe('You will no longer be a member of "Design".');
    expect(copy.confirmLabel).toBe('Leave');
    expect(copy.message).not.toContain('null');
  });

  it('names the team in every variant', () => {
    for (const kind of ['self', 'invite', 'member'] as const) {
      expect(teamRemovalCopy(kind, args).message).toContain('Design');
    }
  });
});
