// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TeamInvite } from '@/lib/api-client';
import { manageTeamsUrl } from '@/lib/auth-config';
import { TeamInvitesPane } from './TeamInvitesPane';

const invite = (over: Partial<TeamInvite> = {}): TeamInvite => ({
  memberId: 'member_1',
  team: { id: 'team_1', name: 'Design', organisation: 'Acme', createdAt: 1, updatedAt: 1 },
  memberCount: 3,
  invitedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  role: 'member',
  invitedByName: 'Ada',
  ...over,
});

// The Invites view (docs/specs/013-workspace/teams.md "Invitations").
describe('TeamInvitesPane', () => {
  it('lists each invitation with who sent it, when, and where to answer it', () => {
    render(
      <TeamInvitesPane
        invites={[
          invite(),
          invite({
            memberId: 'member_2',
            team: { id: 'team_2', name: 'Writers', organisation: null, createdAt: 1, updatedAt: 1 },
            memberCount: 1,
            role: 'admin',
            invitedByName: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText('Design')).toBeTruthy();
    expect(screen.getByText('Acme · 3 members')).toBeTruthy();
    expect(screen.getByText(/^Ada invited you .*ago\.$/)).toBeTruthy();
    expect(screen.getByText('1 member')).toBeTruthy();
    expect(screen.getByText(/^You were invited .*, as an admin\.$/)).toBeTruthy();
    const links = screen.getAllByRole('link', { name: 'Answer on liveworkspace.app' });
    expect(links).toHaveLength(2);
    expect(links[0]!.getAttribute('href')).toBe(`${manageTeamsUrl}#invitations`);
  });

  it('says where invitations show up when there are none', () => {
    render(<TeamInvitesPane invites={[]} />);
    expect(screen.getByText('No pending invites')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
