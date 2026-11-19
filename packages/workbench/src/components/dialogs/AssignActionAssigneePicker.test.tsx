// @vitest-environment jsdom

// The assignee picker every editor shares (docs/specs/012-collaboration/assigned-actions.md §2): each person drawn
// as every other surface does ("Their colour": their chosen presence colour, else the Automatic one from their name,
// never the brand blue), and the Myself-only nudges in the editor's own word for what it edits.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { automaticPresenceColour } from '@liveworkspace/settings/presence';
import { AssigneePicker, type PickableMember } from './AssignActionAssigneePicker';

afterEach(() => cleanup());

const member = (over: Partial<PickableMember>): PickableMember => ({
  userId: 'u',
  memberId: 'm',
  name: 'Bea Holt',
  email: null,
  teamId: 't',
  teamName: 'Crew',
  ...over,
});

const self = member({
  userId: 'me',
  memberId: undefined,
  name: 'Ada',
  teamId: null,
  teamName: null,
});

type Props = ComponentProps<typeof AssigneePicker>;
const picker = (over: Partial<Props> = {}) =>
  render(
    <AssigneePicker
      noun="plan"
      signedIn
      selfRow={self}
      grouped={[]}
      members={[]}
      memberOfItemTeam
      itemTeamId="t"
      assignee={null}
      onPick={vi.fn()}
      signInHref="/sign-in"
      teams={[]}
      movingToTeamId={null}
      moveFailed={false}
      {...over}
    />,
  );

describe('AssigneePicker colours', () => {
  it('paints each person in their presence colour, the selected row included', () => {
    const me = { ...self, color: '#8b5cf6' };
    const chose = member({ userId: 'u1', memberId: 'm1', name: 'Bea Holt', color: '#ef4444' });
    const automatic = member({ userId: 'u2', memberId: 'm2', name: 'Cy Dunn', color: null });
    picker({
      selfRow: me,
      grouped: [['t', { teamName: 'Crew', members: [chose, automatic] }]],
      members: [chose, automatic],
      assignee: chose,
    });
    const [selfDisc, choseDisc, automaticDisc] = screen.getAllByTestId('assignee-disc');

    expect(selfDisc!.style.getPropertyValue('--identity')).toBe('#8b5cf6');
    expect(choseDisc!.style.getPropertyValue('--identity')).toBe('#ef4444');
    expect(automaticDisc!.style.getPropertyValue('--identity')).toBe(
      automaticPresenceColour('Cy Dunn').value,
    );
    // Dark mode paints the colour's deep shade under white; light mode the ink that reaches AA on the colour.
    expect(choseDisc!.style.getPropertyValue('--identity-deep')).toBe('#b91c1c');
    expect(choseDisc!.style.getPropertyValue('--identity-ink')).toMatch(/^#/);
    // No brand fill left on any disc; selection still reads from the row's own tint and label.
    for (const disc of [selfDisc, choseDisc, automaticDisc]) {
      expect(disc!.className).not.toContain('bg-brand');
    }
    const picked = screen.getByRole('button', { name: /Bea Holt/ });
    expect(picked.getAttribute('aria-pressed')).toBe('true');
    expect(picked.className).toContain('bg-brand-50');
    expect(picked.textContent).toContain('Selected');
    expect(screen.getByText('Crew')).toBeTruthy();
  });
});

describe('AssigneePicker rows', () => {
  it('pins Myself with the name after it, marks an invitation, and picks on a press', () => {
    const onPick = vi.fn();
    const invited = member({ userId: null, memberId: 'm3', name: 'Dee Ray', pending: true });
    picker({
      grouped: [['t', { teamName: 'Crew', members: [invited] }]],
      members: [invited],
      assignee: self,
      onPick,
    });
    const myself = screen.getByRole('button', { name: /Myself/ });
    expect(myself.textContent).toContain('Myself (Ada)');
    expect(myself.getAttribute('aria-pressed')).toBe('true');
    const row = screen.getByRole('button', { name: /Dee Ray/ });
    expect(row.textContent).toContain('Invited');
    expect(row.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(row);
    expect(onPick).toHaveBeenCalledWith(invited);
  });

  it('shows the loading row while the team is read, and the invite hint for an empty team', () => {
    const { unmount } = picker({ members: null });
    expect(screen.getByText('Loading teammates…')).toBeTruthy();
    unmount();
    picker({ members: [] });
    expect(screen.getByText(/No other members in this team yet/)).toBeTruthy();
  });

  it('draws no Myself row before identity has hydrated', () => {
    picker({ selfRow: null, members: [member({})] });
    expect(screen.queryByRole('button', { name: /Myself/ })).toBeNull();
  });
});

describe('AssigneePicker nudges', () => {
  it('asks a guest to sign in', () => {
    picker({ signedIn: false, memberOfItemTeam: false, itemTeamId: null });
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in');
  });

  it('offers a personal item a move into each team, in the editor’s noun', () => {
    const onMoveToTeam = vi.fn();
    picker({
      noun: 'design',
      memberOfItemTeam: false,
      itemTeamId: null,
      teams: [
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ],
      onMoveToTeam,
    });
    expect(
      screen.getByText('Move this design into a team library to assign teammates:'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onMoveToTeam).toHaveBeenCalledWith('b');
  });

  it('holds the move buttons while one runs, and says when it failed', () => {
    picker({
      noun: 'canvas',
      memberOfItemTeam: false,
      itemTeamId: null,
      teams: [
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ],
      onMoveToTeam: vi.fn(),
      movingToTeamId: 'a',
      moveFailed: true,
    });
    expect(screen.getByRole('button', { name: 'Moving…' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Beta' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Couldn.t move the canvas\. Check your connection/)).toBeTruthy();
  });

  it('sends someone with no team to the Explorer’s Invites, never a bare team page', () => {
    picker({ noun: 'document', memberOfItemTeam: false, itemTeamId: null, teams: [] });
    expect(screen.getByText(/Actions assign to the document.s team\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create or join a team' }).getAttribute('href')).toBe(
      '/explorer/invites',
    );
  });

  it('keeps the create-a-team link when the editor offers no inline move', () => {
    picker({ memberOfItemTeam: false, itemTeamId: null, teams: [{ id: 'a', name: 'Alpha' }] });
    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Create or join a team' })).toBeTruthy();
  });

  it('tells a share-link editor outside the team that only its members are assignable', () => {
    picker({ memberOfItemTeam: false, itemTeamId: 'other' });
    expect(
      screen.getByText("Only members of this plan's team can be assigned actions."),
    ).toBeTruthy();
  });

  it('says nothing more for a team with members', () => {
    const mate = member({});
    picker({ members: [mate], grouped: [['t', { teamName: 'Crew', members: [mate] }]] });
    expect(screen.queryByText(/No other members/)).toBeNull();
    expect(screen.queryByText(/Loading teammates/)).toBeNull();
  });
});
