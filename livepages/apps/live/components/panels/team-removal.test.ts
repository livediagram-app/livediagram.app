// Removing a row from a team's member list (docs/specs/013-workspace/teams.md + docs/specs/017-telemetry/telemetry.md).
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

  it('calls a declined or expired invitation rejected', () => {
    expect(teamRemovalKind(false, 'declined')).toBe('rejected');
    expect(teamRemovalKind(false, 'expired')).toBe('rejected');
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
    expect(teamRemovalTelemetryType('rejected')).toBe('Rejected');
  });

  it('gives every kind a distinct type, so the buckets stay readable', () => {
    const kinds = ['self', 'invite', 'rejected', 'member'] as const;
    const types = kinds.map(teamRemovalTelemetryType);
    expect(new Set(types).size).toBe(kinds.length);
  });
});

describe('teamRemovalCopy', () => {
  const args = { memberLabel: 'sam', teamName: 'Design' };

  it('asks to withdraw an invitation, and says the person has not joined', () => {
    const copy = teamRemovalCopy('invite', args);
    expect(copy.title).toBe('Withdraw Invite?');
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
    expect(copy.title).toBe('Remove Member?');
    expect(copy.message).toBe('sam will be removed from "Design".');
    expect(copy.confirmLabel).toBe('Remove');
  });

  it('addresses the user directly when they are leaving, ignoring the label', () => {
    const copy = teamRemovalCopy('self', { memberLabel: null, teamName: 'Design' });
    expect(copy.title).toBe('Leave Team?');
    expect(copy.message).toBe('You will no longer be a member of "Design".');
    expect(copy.confirmLabel).toBe('Leave');
    expect(copy.message).not.toContain('null');
  });

  it('says why a rejected row is on the list, and that they can be invited again', () => {
    const declined = teamRemovalCopy('rejected', args);
    expect(declined.title).toBe('Remove from List?');
    expect(declined.message).toContain('sam declined the invite to "Design".');
    expect(declined.message).toContain('invite them again');
    const expired = teamRemovalCopy('rejected', { ...args, expired: true });
    expect(expired.message).toContain('expired with no reply');
    expect(expired.message).not.toContain('declined');
  });

  it('names the team in every variant', () => {
    for (const kind of ['self', 'invite', 'rejected', 'member'] as const) {
      expect(teamRemovalCopy(kind, args).message).toContain('Design');
    }
  });
});
