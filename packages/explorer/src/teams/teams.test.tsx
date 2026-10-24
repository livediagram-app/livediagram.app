// Teams run in the Explorer (liveworkspace/docs/one-explorer.md "Teams are run in the Explorer"): New Team from the
// sidebar and the panel's rail, the team card (its members, roles, removals, Invite, Invite by Link, Edit, Leave and
// Delete), the last-admin rule, and what loads when.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamDetails, TeamsHost } from '../data/teams';
import { applyTeamChanges, teamChanges } from '../data/teamChanges';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from '../explorer/Explorer';
import { ExplorerPanel } from '../panel/ExplorerPanel';
import { lastAdmin, memberName, orderMembers, removalCopy } from './rules';

const details = (over: Partial<TeamDetails['team']> = {}): TeamDetails => ({
  team: {
    id: 't1',
    name: 'Design',
    organisation: 'Northwind',
    myRole: 'admin',
    myMemberId: 'm1',
    ...over,
  },
  members: [
    {
      id: 'm1',
      userId: 'user_me',
      email: 'me@x.test',
      name: 'Sam Doe',
      role: 'admin',
      status: 'joined',
    },
    {
      id: 'm2',
      userId: 'user_ann',
      email: 'ann@x.test',
      name: 'Ann Lee',
      role: 'member',
      status: 'joined',
    },
    {
      id: 'm3',
      userId: null,
      email: 'kai.moss@x.test',
      name: null,
      role: 'member',
      status: 'invited',
    },
  ],
  inviteLink: null,
});

function fakeHost(team: TeamDetails | null = details(), over: Partial<TeamsHost> = {}) {
  const host: TeamsHost = {
    myTeams: vi.fn(async () => ({
      teams: team ? [{ id: team.team.id, name: team.team.name, memberCount: 2 }] : [],
      invitations: [],
    })),
    team: vi.fn(async () => team),
    create: vi.fn(async ({ name }) => ({ ok: true as const, value: { id: 't-new', name } })),
    update: vi.fn(async (id, patch) => ({
      ok: true as const,
      value: { id, name: patch.name ?? 'Design', organisation: patch.organisation ?? null },
    })),
    remove: vi.fn(async () => ({ ok: true as const, value: null })),
    invite: vi.fn(async (_id, input) => ({
      ok: true as const,
      value: {
        id: 'm9',
        userId: null,
        email: input.email,
        name: null,
        role: input.role,
        status: 'invited' as const,
      },
    })),
    setRole: vi.fn(async () => ({ ok: true as const, value: null })),
    removeMember: vi.fn(async (_id, memberId) => ({
      ok: true as const,
      value: {
        teamDeleted: false,
        removed: memberId === 'm1' ? ('self' as const) : ('member' as const),
      },
    })),
    resetInviteLink: vi.fn(async () => ({
      ok: true as const,
      value: {
        url: 'https://liveworkspace.app/join?token=abc',
        expiresAt: Date.now() + 7 * 86_400_000,
      },
    })),
    clearInviteLink: vi.fn(async () => ({ ok: true as const, value: null })),
    answer: vi.fn(),
    onTeamsChanged: vi.fn(),
    ...over,
  };
  return host;
}

function page(
  view: ExplorerView,
  host: TeamsHost | null,
  extra: Partial<React.ComponentProps<typeof Explorer>> = {},
) {
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="liveplanner"
      client={createFakeIndex({ items: [makeItem(1, { teamId: 't1' })] }).client}
      view={view}
      onNavigate={onNavigate}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
      teams={[{ id: 't1', name: 'Design' }]}
      teamsHost={host}
      {...extra}
    />,
  );
  return onNavigate;
}

const card = () => screen.findByText('Northwind · 2 members · 1 invited · You’re an admin');

describe('a team’s view', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => teamChanges.reset());

  it('shows its card over its library: members, invitations and the admin line', async () => {
    page({ kind: 'team', id: 't1' }, fakeHost());
    expect(await card()).toBeTruthy();
    expect(screen.getByText('you')).toBeTruthy();
    expect(screen.getByText('Kai Moss')).toBeTruthy();
    expect(screen.getByText('Invited')).toBeTruthy();
    expect(await screen.findByText('Item 1')).toBeTruthy();
  });

  it('pins the only admin, and lets an admin change another’s role', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1' }, host);
    await card();
    expect(screen.queryByRole('combobox', { name: 'Role for Sam Doe' })).toBeNull();
    expect(screen.getByText('Only admin')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Role for Ann Lee' }), {
      target: { value: 'admin' },
    });
    await waitFor(() => expect(host.setRole).toHaveBeenCalledWith('t1', 'm2', 'admin'));
    // Read again after the change.
    await waitFor(() => expect(host.team).toHaveBeenCalledTimes(2));
  });

  it('asks before removing, in words that say who goes', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1' }, host);
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw invite to Kai Moss' }));
    const ask = await screen.findByRole('dialog', { name: 'Withdraw Invite?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Withdraw Invite' }));
    await waitFor(() => expect(host.removeMember).toHaveBeenCalledWith('t1', 'm3'));
  });

  it('invites an address as a Member or an Admin', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1' }, host);
    await card();
    fireEvent.change(screen.getByLabelText('Email address to invite'), {
      target: { value: 'zoe@x.test' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Role for the invitation' }), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(() =>
      expect(host.invite).toHaveBeenCalledWith('t1', { email: 'zoe@x.test', role: 'admin' }),
    );
    expect(await screen.findByText('Invitation sent to zoe@x.test.')).toBeTruthy();
  });

  it('turns the join link on, and copies it', async () => {
    const team = details();
    const host = fakeHost(team, {
      resetInviteLink: vi.fn(async () => {
        team.inviteLink = {
          url: 'https://liveworkspace.app/join?token=abc',
          expiresAt: Date.now(),
        };
        return { ok: true as const, value: team.inviteLink };
      }),
    });
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    page({ kind: 'team', id: 't1' }, host);
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Invite by Link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn On Link' }));
    await waitFor(() => expect(host.resetInviteLink).toHaveBeenCalledWith('t1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://liveworkspace.app/join?token=abc'),
    );
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('renames from Edit Team: the sidebar follows at once', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1' }, host);
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Design options' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit Team' }));
    const form = await screen.findByRole('dialog', { name: 'Edit Team' });
    fireEvent.change(within(form).getByLabelText('Team name'), { target: { value: 'Product' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(host.update).toHaveBeenCalledWith('t1', {
        name: 'Product',
        organisation: 'Northwind',
      }),
    );
    expect(await screen.findByRole('treeitem', { name: /Product/ })).toBeTruthy();
    expect(host.onTeamsChanged).toHaveBeenCalled();
  });

  it('deletes after asking, then goes to My Work and the team leaves the sidebar', async () => {
    const host = fakeHost();
    const onNavigate = page({ kind: 'team', id: 't1' }, host);
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Design options' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Team' }));
    const ask = await screen.findByRole('dialog', { name: 'Delete Team?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete Team' }));
    await waitFor(() => expect(host.remove).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith({ kind: 'all' }, '/explorer/all'));
    expect(await screen.findByText('Design was deleted.')).toBeTruthy();
  });

  it('lets a member leave, but not the only admin of a team with others in it', async () => {
    page({ kind: 'team', id: 't1' }, fakeHost());
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Design options' }));
    const leave = await screen.findByRole('menuitem', { name: 'Leave Team' });
    expect(leave.getAttribute('aria-disabled')).toBe('true');
  });

  it('is a not-found card for a team the person is not in', async () => {
    page({ kind: 'team', id: 'gone' }, fakeHost(null));
    expect(await screen.findByText('Team not found')).toBeTruthy();
  });

  it('shows the library alone without a TeamsHost', async () => {
    page({ kind: 'team', id: 't1' }, null);
    expect(await screen.findByText('Item 1')).toBeTruthy();
    expect(screen.queryByText(/members/)).toBeNull();
  });
});

describe('New Team', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => teamChanges.reset());

  it('is the last row of Spaces: the dialog makes the team and opens it', async () => {
    const host = fakeHost();
    const onNavigate = page({ kind: 'all' }, host);
    const row = await screen.findByRole('treeitem', { name: 'New Team' });
    fireEvent.click(row.querySelector('[data-tree-activate]')!);
    const form = await screen.findByRole('dialog', { name: 'New Team' });
    fireEvent.change(within(form).getByLabelText('Team name'), { target: { value: 'Ops' } });
    fireEvent.change(within(form).getByLabelText(/Organisation/), { target: { value: 'Acme' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create Team' }));
    await waitFor(() =>
      expect(host.create).toHaveBeenCalledWith({ name: 'Ops', organisation: 'Acme' }),
    );
    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith(
        { kind: 'team', id: 't-new' },
        '/explorer/team?id=t-new',
      ),
    );
    expect(await screen.findByRole('treeitem', { name: /^Ops/ })).toBeTruthy();
    expect(host.onTeamsChanged).toHaveBeenCalled();
  });

  it('says a refusal in words and keeps the dialog', async () => {
    const host = fakeHost(details(), {
      create: vi.fn(async () => ({ ok: false as const, error: 'team_limit_reached' })),
    });
    page({ kind: 'all' }, host);
    const row = await screen.findByRole('treeitem', { name: 'New Team' });
    fireEvent.click(row.querySelector('[data-tree-activate]')!);
    const form = await screen.findByRole('dialog', { name: 'New Team' });
    fireEvent.change(within(form).getByLabelText('Team name'), { target: { value: 'Ops' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create Team' }));
    expect(await within(form).findByText('You can be in up to 50 teams.')).toBeTruthy();
  });

  it('is not offered to a guest, nor without a TeamsHost', async () => {
    page({ kind: 'all' }, fakeHost(), { signedIn: false, signInHref: '/sign-in' });
    expect(await screen.findByRole('link', { name: /Sign in to access Teams/ })).toBeTruthy();
    expect(screen.queryByRole('treeitem', { name: 'New Team' })).toBeNull();
  });

  it('reads the teams list once as the page opens, and a team only when its view opens', async () => {
    const host = fakeHost();
    page({ kind: 'all' }, host);
    await screen.findByRole('treeitem', { name: 'Design (2 members)' });
    expect(host.myTeams).toHaveBeenCalledTimes(1);
    expect(host.team).not.toHaveBeenCalled();
  });
});

describe('teams in the editor’s panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => teamChanges.reset());

  function panel(host: TeamsHost | null) {
    render(
      <ExplorerPanel
        app="liveplanner"
        client={createFakeIndex({ items: [] }).client}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        teams={[{ id: 't1', name: 'Design' }]}
        teamsHost={host}
      />,
    );
  }
  const rail = () => within(screen.getByRole('navigation', { name: 'Explorer sections' }));

  it('asks nothing about teams until Members opens, then runs the team in a dialog', async () => {
    const host = fakeHost();
    panel(host);
    fireEvent.click(rail().getByRole('button', { name: 'Design' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Members' }));
    expect(await screen.findByRole('dialog', { name: 'Design members' })).toBeTruthy();
    expect(await card()).toBeTruthy();
    expect(host.myTeams).not.toHaveBeenCalled();
    expect(host.team).toHaveBeenCalledTimes(1);
  });

  it('makes a team from New Team on the rail, and opens it', async () => {
    const host = fakeHost();
    panel(host);
    fireEvent.click(rail().getByRole('button', { name: 'New Team' }));
    const form = await screen.findByRole('dialog', { name: 'New Team' });
    fireEvent.change(within(form).getByLabelText('Team name'), { target: { value: 'Ops' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create Team' }));
    expect(await rail().findByRole('button', { name: 'Ops' })).toBeTruthy();
    expect(rail().getByRole('button', { name: 'Ops' }).getAttribute('aria-current')).toBe('true');
  });

  it('offers neither without a TeamsHost', () => {
    panel(null);
    expect(rail().queryByRole('button', { name: 'New Team' })).toBeNull();
    fireEvent.click(rail().getByRole('button', { name: 'Design' }));
    expect(screen.queryByRole('button', { name: 'Members' })).toBeNull();
  });
});

describe('the team rules', () => {
  it('keeps a joined admin', () => {
    const { members } = details();
    expect(lastAdmin(members, 'm1')).toEqual({ onlyAdmin: true, alone: false, canLeave: false });
    expect(lastAdmin(members, 'm2')).toEqual({ onlyAdmin: false, alone: false, canLeave: true });
    expect(lastAdmin(members.slice(0, 1), 'm1')).toEqual({
      onlyAdmin: true,
      alone: true,
      canLeave: true,
    });
  });

  it('orders admins, members, then invitations', () => {
    const { members } = details();
    expect(orderMembers([...members].reverse()).map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('names someone from their address, and words each removal', () => {
    expect(memberName({ name: null, email: 'anna.smith@x.test' }, false)).toBe('Anna Smith');
    expect(removalCopy('self', 'You', 'Design', true).confirm).toBe('Leave and Delete');
    expect(removalCopy('declined', 'Kai', 'Design').title).toBe('Remove from List?');
  });

  it('lays changes made here over the known list', () => {
    const known = [
      { id: 't1', name: 'Design' },
      { id: 't2', name: 'Ops' },
    ];
    teamChanges.made({ id: 't3', name: 'New' });
    teamChanges.renamed('t1', 'Product');
    teamChanges.gone('t2');
    expect(applyTeamChanges(known, teamChanges.snapshot())).toEqual([
      { id: 't1', name: 'Product' },
      { id: 't3', name: 'New' },
    ]);
    teamChanges.reset();
  });
});
