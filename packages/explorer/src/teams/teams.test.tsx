// Teams run in the Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in the Explorer"): New Team from the
// sidebar and the panel's rail, the team card (its members, roles, removals, Invite, Invite by Link, Edit, Leave and
// Delete), the last-admin rule, and what loads when.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamDetails, TeamsHost } from '../data/teams';
import { applyTeamChanges, teamChanges } from '../data/teamChanges';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from '../explorer/Explorer';
import { landOnMyWork } from '../explorer/TeamPane';
import { ExplorerPanel } from '../panel/ExplorerPanel';
import { avatarFill } from '@liveworkspace/account-menu/initials';
import { memberFill } from './TeamCard';
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
    resendInvite: vi.fn(async () => ({ ok: true as const, value: null })),
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

const HEADLINE = 'Northwind · 2 members · 1 invited · You’re an admin';
const card = () => screen.findByText((_, el) => el?.tagName === 'P' && el.textContent === HEADLINE);

describe('a team’s view', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => teamChanges.reset());

  it('opens on its Library, the first tab, when no tab is named', async () => {
    page({ kind: 'team', id: 't1' }, fakeHost());
    expect(await screen.findByText('Item 1')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Design' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('data-team-tab'))).toEqual([
      'library',
      'people',
      'audit',
    ]);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').id).toBe('team-panel-library');
    expect(screen.queryByRole('heading', { name: 'Waiting to Join' })).toBeNull();
  });

  it('shows the Library first and People second to a Member, with no Audit Log', async () => {
    page({ kind: 'team', id: 't1' }, fakeHost(details({ myRole: 'member', myMemberId: 'm2' })));
    expect(await screen.findByText('Item 1')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('data-team-tab'))).toEqual([
      'library',
      'people',
    ]);
  });

  it('opens People when the address names it: its header, members, invitations and the admin line', async () => {
    page({ kind: 'team', id: 't1', tab: 'people' }, fakeHost());
    expect(await card()).toBeTruthy();
    expect(screen.getByRole('tab', { name: /People/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('you')).toBeTruthy();
    expect(screen.getByText('kai.moss@x.test')).toBeTruthy();
    expect(screen.getByText('Invited')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Waiting to Join' })).toBeTruthy();
    expect(screen.queryByText('Item 1')).toBeNull();
  });

  it('shows the library on its Library tab, with the toolbar in place of a title', async () => {
    page({ kind: 'team', id: 't1' }, fakeHost());
    expect(await screen.findByText('Item 1')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Library/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      'Design',
    ]);
    expect(screen.getByRole('button', { name: 'New' }).getAttribute('aria-haspopup')).toBe('menu');
  });

  it('moves between tabs through the address, and with the arrow keys', async () => {
    const onNavigate = page({ kind: 'team', id: 't1', tab: 'people' }, fakeHost());
    await card();
    fireEvent.click(screen.getByRole('tab', { name: /Library/ }));
    // The Library is the default: its address names no tab.
    expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'team', id: 't1' }, '/explorer/team?id=t1');
    fireEvent.keyDown(screen.getByRole('tab', { name: /People/ }), { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenLastCalledWith(
      { kind: 'team', id: 't1', tab: 'audit' },
      '/explorer/team?id=t1&tab=audit',
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: /Library/ }), { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenLastCalledWith(
      { kind: 'team', id: 't1', tab: 'audit' },
      '/explorer/team?id=t1&tab=audit',
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: /Library/ }), { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenLastCalledWith(
      { kind: 'team', id: 't1', tab: 'people' },
      '/explorer/team?id=t1&tab=people',
    );
  });

  // Work Tracker 1504: a library of folders alone read 0 on its tab.
  it('counts the folders at the Library root on its tab, beside the items', async () => {
    const teamFolder = (id: string) => ({
      id,
      name: `Folder ${id}`,
      parentId: null,
      teamId: 't1',
      ownerId: 'user_me',
      createdAt: 1,
      updatedAt: 1,
    });
    page({ kind: 'team', id: 't1' }, fakeHost(), {
      client: createFakeIndex({ folders: [teamFolder('fa'), teamFolder('fb')] }).client,
    });
    expect(await screen.findByText('Folder fa')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Library/ }).textContent).toBe('Library2'),
    );
  });

  it('counts the items and the root folders together', async () => {
    page({ kind: 'team', id: 't1' }, fakeHost(), {
      client: createFakeIndex({
        items: [makeItem(1, { teamId: 't1' }), makeItem(2, { teamId: 't1' })],
        folders: [
          {
            id: 'fa',
            name: 'Briefs',
            parentId: null,
            teamId: 't1',
            ownerId: 'user_me',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }).client,
    });
    expect(await screen.findByText('Item 2')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Library/ }).textContent).toBe('Library3'),
    );
  });

  it('keeps the lens when going back to the Library', async () => {
    const onNavigate = page(
      { kind: 'team', id: 't1', tab: 'people', q: 'opens-in:plan' },
      fakeHost(),
    );
    await card();
    fireEvent.click(screen.getByRole('tab', { name: /Library/ }));
    expect(onNavigate).toHaveBeenLastCalledWith(
      { kind: 'team', id: 't1', q: 'opens-in:plan' },
      '/explorer/team?id=t1&q=opens-in%3Aplan',
    );
  });

  it('lands a Member who follows an Audit Log link on the Library', async () => {
    page(
      { kind: 'team', id: 't1', tab: 'audit' },
      fakeHost(details({ myRole: 'member', myMemberId: 'm2' })),
    );
    expect(await screen.findByText('Item 1')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Library/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('takes Invite People from the Library to People', async () => {
    const onNavigate = page({ kind: 'team', id: 't1' }, fakeHost());
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Invite People' }));
    expect(onNavigate).toHaveBeenLastCalledWith(
      { kind: 'team', id: 't1', tab: 'people' },
      '/explorer/team?id=t1&tab=people',
    );
  });

  it('filters people by chip and by search', async () => {
    page({ kind: 'team', id: 't1', tab: 'people' }, fakeHost());
    await card();
    const rows = () =>
      [...document.querySelectorAll('[data-team-member]')].map((r) =>
        r.getAttribute('data-team-member'),
      );
    expect(rows()).toEqual(['m1', 'm2', 'm3']);
    fireEvent.click(screen.getByRole('button', { name: /^Admins/ }));
    expect(rows()).toEqual(['m1']);
    fireEvent.click(screen.getByRole('button', { name: /^Pending/ }));
    expect(rows()).toEqual(['m3']);
    fireEvent.click(screen.getByRole('button', { name: /^Everyone/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), {
      target: { value: 'ANN' },
    });
    expect(rows()).toEqual(['m2']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), {
      target: { value: 'nobody' },
    });
    expect(screen.getByText('No one matches “nobody”.')).toBeTruthy();
  });

  it('resends an open invitation, and invites an ended one again', async () => {
    const team = details();
    team.members.push({
      id: 'm4',
      userId: null,
      email: 'old@x.test',
      name: null,
      role: 'admin',
      status: 'invited',
      expired: true,
    });
    const host = fakeHost(team);
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    fireEvent.click(
      within(document.querySelector<HTMLElement>('[data-team-member="m3"]')!).getByRole('button', {
        name: 'Resend',
      }),
    );
    await waitFor(() => expect(host.resendInvite).toHaveBeenCalledWith('t1', 'm3'));
    expect(await screen.findByText('Invitation sent again to kai.moss@x.test.')).toBeTruthy();
    const old = document.querySelector<HTMLElement>('[data-team-member="m4"]')!;
    expect(old.textContent).toContain('Expired');
    fireEvent.click(within(old).getByRole('button', { name: 'Invite Again' }));
    await waitFor(() =>
      expect(host.invite).toHaveBeenCalledWith('t1', { email: 'old@x.test', role: 'admin' }),
    );
    expect(within(old).getByRole('button', { name: 'Remove old@x.test from list' })).toBeTruthy();
  });

  it('says why a resend was refused', async () => {
    const host = fakeHost(details(), {
      resendInvite: vi.fn(async () => ({ ok: false as const, error: 'resend_too_soon' })),
    });
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    expect(await screen.findByText(/This invitation was just sent/)).toBeTruthy();
  });

  it('shows a Member no invite tools, roles as pills, and no Audit Log', async () => {
    page(
      { kind: 'team', id: 't1', tab: 'people' },
      fakeHost(details({ myRole: 'member', myMemberId: 'm2' })),
    );
    await screen.findByText(/2 members/);
    expect(screen.queryByText('Invite by Email')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Invite People' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Role for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resend' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Audit Log/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Invite Link' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'What Each Role Can Do' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave Team' }).hasAttribute('disabled')).toBe(false);
  });

  it("paints each member's disc as their account button is painted, own colour or Automatic", async () => {
    const team = details();
    team.members[1]!.color = '#2563eb';
    page({ kind: 'team', id: 't1', tab: 'people' }, fakeHost(team));
    await card();
    const disc = (id: string) =>
      document.querySelector<HTMLElement>(`[data-team-member="${id}"] [data-optical="disc"]`)!;
    const rgb = (colour: string) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = colour;
      return probe.style.backgroundColor;
    };
    // A custom colour, and Automatic (picked from the name), each the header avatar's own fill for that account.
    expect(rgb(avatarFill('Ann Lee', '#2563eb'))).not.toBe('');
    expect(disc('m2').style.backgroundColor).toBe(rgb(avatarFill('Ann Lee', '#2563eb')));
    expect(disc('m2').textContent).toBe('AL');
    expect(disc('m1').style.backgroundColor).toBe(rgb(avatarFill('Sam Doe', null)));
    // The member row's fill and the account button's are one function of the same account.
    for (const color of ['#f97316', '#2563eb', null]) {
      expect(memberFill({ color }, 'Ada Quinn')).toBe(avatarFill('Ada Quinn', color));
    }
  });

  it('isolates the organisation, names and addresses, so right-to-left text turns nothing else around', async () => {
    const team = details({ organisation: '\u202Eevil org' });
    team.members[1]!.name = '\u202Eeel nna';
    page({ kind: 'team', id: 't1', tab: 'people' }, fakeHost(team));
    const headline = await screen.findByText(
      (_, el) =>
        el?.tagName === 'P' &&
        el.textContent === `\u202Eevil org · 2 members · 1 invited · You’re an admin`,
    );
    expect(headline.querySelector('bdi')?.textContent).toBe('\u202Eevil org');
    expect(screen.getByText('\u202Eeel nna').tagName).toBe('BDI');
    expect(screen.getByText('ann@x.test').tagName).toBe('BDI');
  });

  it('pins the only admin, and lets an admin change another’s role', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
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
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw invite to kai.moss@x.test' }));
    const ask = await screen.findByRole('dialog', { name: 'Withdraw Invite?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Withdraw Invite' }));
    await waitFor(() => expect(host.removeMember).toHaveBeenCalledWith('t1', 'm3'));
  });

  it('keeps focus on the card after a removal, not on the row that goes', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    const withdraw = screen.getByRole('button', { name: 'Withdraw invite to kai.moss@x.test' });
    withdraw.focus();
    fireEvent.click(withdraw);
    const ask = await screen.findByRole('dialog', { name: 'Withdraw Invite?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Withdraw Invite' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Design options' })),
    );
  });

  it('invites an address as a Member or an Admin', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    fireEvent.change(screen.getByLabelText('Invite by Email'), {
      target: { value: 'zoe@x.test' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Role for the invitation' }), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
    await waitFor(() =>
      expect(host.invite).toHaveBeenCalledWith('t1', { email: 'zoe@x.test', role: 'admin' }),
    );
    expect(await screen.findByText('Invitation sent to zoe@x.test.')).toBeTruthy();
  });

  it('invites several pasted addresses at once, keeping the refused ones with why', async () => {
    const invite = vi.fn(async (_team: string, { email }: { email: string }) =>
      email === 'taken@x.test'
        ? { ok: false as const, error: 'already_member' }
        : { ok: true as const, value: undefined },
    );
    const host = fakeHost(details(), { invite } as unknown as Partial<TeamsHost>);
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    const field = screen.getByLabelText('Invite by Email');
    fireEvent.paste(field, {
      clipboardData: { getData: () => 'Zoe <zoe@x.test>, taken@x.test; amy@x.test' },
    });
    expect(
      [...document.querySelectorAll('[data-invite-chip]')].map((c) =>
        c.getAttribute('data-invite-chip'),
      ),
    ).toEqual(['zoe@x.test', 'taken@x.test', 'amy@x.test']);
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 Invites' }));
    await waitFor(() => expect(invite).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('Invitations sent to 2 people.')).toBeTruthy();
    expect(
      [...document.querySelectorAll('[data-invite-chip]')].map((c) =>
        c.getAttribute('data-invite-chip'),
      ),
    ).toEqual(['taken@x.test']);
    expect(screen.getByRole('alert').textContent).toContain('taken@x.test');
  });

  it('won’t send while a word isn’t an address', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    fireEvent.paste(screen.getByLabelText('Invite by Email'), {
      clipboardData: { getData: () => 'zoe@x.test nope' },
    });
    expect(screen.getByText(/nope isn’t an email address/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send 2 Invites' }).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove nope' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send Invite' }).disabled).toBe(
      false,
    );
  });

  it('keeps the keyboard on Invite while it sends, then hands it to the emptied field', async () => {
    let finish: () => void = () => {};
    const invite = vi.fn(
      () =>
        new Promise<{ ok: true; value: undefined }>(
          (r) => (finish = () => r({ ok: true, value: undefined })),
        ),
    );
    const host = fakeHost(details(), { invite } as unknown as Partial<TeamsHost>);
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    const field = screen.getByLabelText('Invite by Email');
    fireEvent.change(field, { target: { value: 'zoe@x.test' } });
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Send Invite' });
    button.focus();
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(invite).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByText('Invitation sent to zoe@x.test.');
    expect(document.activeElement).toBe(field);
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
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    const linkCard = () => document.querySelector<HTMLElement>('[data-team-link]')!;
    expect(linkCard().getAttribute('data-team-link')).toBe('off');
    fireEvent.click(within(linkCard()).getByRole('button', { name: 'Turn On Link' }));
    await waitFor(() => expect(host.resetInviteLink).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(linkCard().getAttribute('data-team-link')).toBe('on'));
    expect(
      within(linkCard()).getByRole<HTMLInputElement>('textbox', { name: 'Join link' }).value,
    ).toBe('https://liveworkspace.app/join?token=abc');
    fireEvent.click(within(linkCard()).getByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://liveworkspace.app/join?token=abc'),
    );
    expect(await screen.findByText('Link copied.')).toBeTruthy();
    // The header's Copy Link copies the same link.
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  });

  it('opens Invite Link from Copy Link while the link is off', async () => {
    page({ kind: 'team', id: 't1', tab: 'people' }, fakeHost());
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    expect(await screen.findByRole('dialog', { name: /Invite by Link/ })).toBeTruthy();
  });

  it('takes Invite People to the field', async () => {
    page({ kind: 'team', id: 't1', tab: 'people' }, fakeHost());
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Invite People' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Invite by Email')),
    );
  });

  it('renames from Edit Team: the sidebar follows at once', async () => {
    const host = fakeHost();
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
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
    const onNavigate = page({ kind: 'team', id: 't1', tab: 'people' }, host);
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Design options' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Team' }));
    const ask = await screen.findByRole('dialog', { name: 'Delete Team?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete Team' }));
    await waitFor(() => expect(host.remove).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith({ kind: 'all' }, '/explorer/all'));
    expect(await screen.findByText('Design was deleted.')).toBeTruthy();
    // The card and its ⋯ are going: the keyboard lands on My Work's row, where the person now is, not the body.
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'My Work' }));
  });

  it('lands on the sections bar when the sidebar is out of reach (a phone, its drawer shut)', () => {
    render(
      <div data-explorer="">
        <button type="button" data-sections-bar="" aria-label="Open Sidebar, Current: My Work" />
      </div>,
    );
    landOnMyWork();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Open Sidebar, Current: My Work' }),
    );
  });

  it('drops a team the person was removed from elsewhere when its view finds them gone', async () => {
    const host = fakeHost(null, {
      myTeams: vi
        .fn()
        .mockResolvedValueOnce({
          teams: [{ id: 't1', name: 'Design', memberCount: 2 }],
          invitations: [],
        })
        .mockResolvedValue({ teams: [], invitations: [] }),
    });
    page({ kind: 'team', id: 't1', tab: 'people' }, host);
    expect(await screen.findByText('Team not found')).toBeTruthy();
    await waitFor(() => expect(host.myTeams).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: /^Design/ })).toBeNull());
  });

  it('brings back a team left here once the person is added back elsewhere', async () => {
    const host = fakeHost();
    const now = vi.spyOn(Date, 'now');
    try {
      now.mockReturnValue(2_000_000);
      page({ kind: 'all' }, host);
      await screen.findByRole('treeitem', { name: 'Design (2 members)' });
      act(() => teamChanges.gone('t1'));
      await waitFor(() => expect(screen.queryByRole('treeitem', { name: /^Design/ })).toBeNull());
      // Back at the tab, accounts lists the team again.
      now.mockReturnValue(2_031_000);
      fireEvent.focus(window);
      expect(await screen.findByRole('treeitem', { name: 'Design (2 members)' })).toBeTruthy();
    } finally {
      now.mockRestore();
    }
  });

  it('reads the teams again on coming back to the tab, so a removal elsewhere leaves the sidebar', async () => {
    const host = fakeHost(details(), {
      myTeams: vi
        .fn()
        .mockResolvedValueOnce({
          teams: [{ id: 't1', name: 'Design', memberCount: 2 }],
          invitations: [],
        })
        .mockResolvedValue({ teams: [], invitations: [] }),
    });
    const now = vi.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1_000_000);
      page({ kind: 'all' }, host);
      await screen.findByRole('treeitem', { name: 'Design (2 members)' });
      // Within 30 s of the last read: not asked again.
      now.mockReturnValue(1_010_000);
      fireEvent.focus(window);
      expect(host.myTeams).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1_031_000);
      fireEvent.focus(window);
      await waitFor(() => expect(host.myTeams).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole('treeitem', { name: /^Design/ })).toBeNull());
    } finally {
      now.mockRestore();
    }
  });

  it('lets a member leave, but not the only admin of a team with others in it', async () => {
    page({ kind: 'team', id: 't1', tab: 'people' }, fakeHost());
    await card();
    expect(screen.getByRole('button', { name: 'Leave Team' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/You’re its only admin/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Design options' }));
    expect(await screen.findByRole('menuitem', { name: 'Delete Team' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Leave Team' })).toBeNull();
  });

  it('is a not-found card for a team the person is not in', async () => {
    page({ kind: 'team', id: 'gone' }, fakeHost(null));
    expect(await screen.findByText('Team not found')).toBeTruthy();
    // Nothing offers to make or filter anything in a team that isn't there.
    expect(screen.queryByRole('group', { name: 'View mode' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Create|New Plan|New Folder)/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Filters' })).toBeNull();
    // White on brand-600 (sky, liveworkspace's brand) is 4.09:1: the way back is the shared primary Button, on 700;
    // the 404 label lightens on the dark card (rose-600 there is 3.49:1).
    const notFound = (await screen.findByText('Team not found')).closest('div')!;
    expect(notFound.querySelector('button')?.className).toContain('bg-brand-700');
    expect(screen.getByText('404').className).toContain('dark:text-rose-400');
  });

  it('shows the library alone without a TeamsHost', async () => {
    page({ kind: 'team', id: 't1', tab: 'people' }, null);
    expect(await screen.findByText('Item 1')).toBeTruthy();
    expect(screen.queryByText(/members/)).toBeNull();
  });
});

describe('New Team', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => teamChanges.reset());

  it('is the plus at the right of the Spaces heading: the dialog makes the team and opens it', async () => {
    const host = fakeHost();
    const onNavigate = page({ kind: 'all' }, host);
    // A heading action, never a row of the tree.
    const plus = await screen.findByRole('button', { name: 'New Team' });
    expect(plus.closest('[role="tree"]')).toBeNull();
    expect(screen.queryByRole('treeitem', { name: 'New Team' })).toBeNull();
    fireEvent.click(plus);
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
    fireEvent.click(await screen.findByRole('button', { name: 'New Team' }));
    const form = await screen.findByRole('dialog', { name: 'New Team' });
    fireEvent.change(within(form).getByLabelText('Team name'), { target: { value: 'Ops' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create Team' }));
    expect(await within(form).findByText('You can be in up to 50 teams.')).toBeTruthy();
  });

  // Work Tracker 1071: no answer in time, so the team may exist; Refresh checks rather than making a second one.
  describe('when accounts did not answer in time', () => {
    const UNCONFIRMED = 'The team may have been made. Refresh to check.';
    const unconfirmed = (myTeams: TeamsHost['myTeams']) =>
      fakeHost(details(), {
        create: vi.fn(async () => ({ ok: false as const, error: 'team_create_unconfirmed' })),
        myTeams,
      });
    async function tryOps(host: TeamsHost) {
      const onNavigate = page({ kind: 'all' }, host);
      fireEvent.click(await screen.findByRole('button', { name: 'New Team' }));
      const form = await screen.findByRole('dialog', { name: 'New Team' });
      fireEvent.change(within(form).getByLabelText('Team name'), { target: { value: 'Ops' } });
      fireEvent.click(within(form).getByRole('button', { name: 'Create Team' }));
      const alert = await within(form).findByRole('alert');
      await waitFor(() => expect(alert.textContent).toContain(UNCONFIRMED));
      return { form, alert, onNavigate };
    }
    const listed = (...names: [string, string][]) =>
      vi.fn(async () => ({
        teams: names.map(([id, name]) => ({ id, name, memberCount: 1 })),
        invitations: [],
      }));

    it('says the team may have been made, and Refresh opens it when it was', async () => {
      const myTeams = listed(['t1', 'Design']);
      const host = unconfirmed(myTeams);
      const { alert, onNavigate } = await tryOps(host);
      myTeams.mockResolvedValue({
        teams: [
          { id: 't1', name: 'Design', memberCount: 2 },
          { id: 't-ops', name: 'Ops', memberCount: 1 },
        ],
        invitations: [],
      });
      fireEvent.click(within(alert).getByRole('button', { name: 'Refresh' }));
      await waitFor(() =>
        expect(onNavigate).toHaveBeenCalledWith(
          { kind: 'team', id: 't-ops' },
          '/explorer/team?id=t-ops',
        ),
      );
      expect(screen.queryByRole('dialog', { name: 'New Team' })).toBeNull();
      expect(host.create).toHaveBeenCalledTimes(1);
    });

    it('says none was made when Refresh finds no new team of that name', async () => {
      const { alert } = await tryOps(unconfirmed(listed(['t1', 'Design'])));
      fireEvent.click(within(alert).getByRole('button', { name: 'Refresh' }));
      await waitFor(() =>
        expect(alert.textContent).toBe('No team was made. You can create it now.'),
      );
      expect(within(alert).queryByRole('button', { name: 'Refresh' })).toBeNull();
    });

    it('keeps the question open when the list cannot be read', async () => {
      const myTeams = listed(['t1', 'Design']);
      const { form } = await tryOps(unconfirmed(myTeams));
      myTeams.mockRejectedValue(new Error('offline'));
      fireEvent.click(within(form).getByRole('button', { name: 'Refresh' }));
      await waitFor(() => expect(myTeams).toHaveBeenCalledTimes(2));
      const again = await within(form).findByRole('button', { name: 'Refresh' });
      expect(within(form).getByRole('alert').textContent).toContain(UNCONFIRMED);
      expect(again.getAttribute('aria-disabled')).toBeNull();
    });
  });

  it('is not offered to a guest, nor without a TeamsHost', async () => {
    page({ kind: 'all' }, fakeHost(), { signedIn: false, signInHref: '/sign-in' });
    const nudge = await screen.findByRole('link', { name: /Sign In to Use Teams/ });
    expect(screen.queryByRole('button', { name: 'New Team' })).toBeNull();
    // Outside the Spaces tree, which holds only treeitems (axe aria-required-children).
    expect(nudge.closest('[role="tree"]')).toBeNull();
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

  it('lands on the rail’s Home after deleting the team from Members', async () => {
    const host = fakeHost();
    panel(host);
    fireEvent.click(rail().getByRole('button', { name: 'Design' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Members' }));
    await card();
    fireEvent.click(screen.getByRole('button', { name: 'Design options' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Team' }));
    const ask = await screen.findByRole('dialog', { name: 'Delete Team?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete Team' }));
    await waitFor(() => expect(host.remove).toHaveBeenCalledWith('t1'));
    await waitFor(() =>
      expect(document.activeElement).toBe(rail().getByRole('button', { name: /^Home/ })),
    );
    expect(screen.queryByRole('dialog', { name: 'Design members' })).toBeNull();
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

  // Work Tracker 1071, in each app's editor panel (the one shared panel and host every app passes).
  it.each(['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'] as const)(
    'in %s, says an unconfirmed team may have been made, and Refresh opens it',
    async (app) => {
      const host = fakeHost(details(), {
        create: vi.fn(async () => ({ ok: false as const, error: 'team_create_unconfirmed' })),
        myTeams: vi.fn(async () => ({
          teams: [{ id: 't-ops', name: 'Ops', memberCount: 1 }],
          invitations: [],
        })),
      });
      render(
        <ExplorerPanel
          app={app}
          client={createFakeIndex({ items: [] }).client}
          itemHref={(i) => `/p/${i.id}`}
          onCreate={vi.fn()}
          teams={[{ id: 't1', name: 'Design' }]}
          teamsHost={host}
        />,
      );
      fireEvent.click(rail().getByRole('button', { name: 'New Team' }));
      const form = await screen.findByRole('dialog', { name: 'New Team' });
      fireEvent.change(within(form).getByLabelText('Team name'), { target: { value: 'Ops' } });
      fireEvent.click(within(form).getByRole('button', { name: 'Create Team' }));
      const alert = await within(form).findByRole('alert');
      await waitFor(() =>
        expect(alert.textContent).toContain('The team may have been made. Refresh to check.'),
      );
      fireEvent.click(within(alert).getByRole('button', { name: 'Refresh' }));
      expect(await rail().findByRole('button', { name: 'Ops' })).toBeTruthy();
    },
  );

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

  it('shows a team left here again only once a later read lists it (added back elsewhere)', () => {
    const known = [{ id: 't1', name: 'Design' }];
    const before = teamChanges.stamp();
    teamChanges.gone('t1');
    // A read already out when the person left still lists it: it stays gone.
    teamChanges.listed(['t1'], before);
    expect(applyTeamChanges(known, teamChanges.snapshot())).toEqual([]);
    // A read made after the leave lists it: they were added back.
    const after = teamChanges.stamp();
    teamChanges.listed(['t1'], after);
    expect(applyTeamChanges(known, teamChanges.snapshot())).toEqual(known);
    // Nothing to bring back: the changes stay as they are.
    const same = teamChanges.snapshot();
    teamChanges.listed(['t2'], teamChanges.stamp());
    expect(teamChanges.snapshot()).toBe(same);
    teamChanges.reset();
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
