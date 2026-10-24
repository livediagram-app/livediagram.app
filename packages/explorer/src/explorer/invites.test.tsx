// The Invites view (livediagram's TeamInvitesPane): a card per invitation waiting, answered in place.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnsweredInvitation, PendingInvitation, TeamsHost } from '../data/teams';
import { teamChanges } from '../data/teamChanges';
import { createFakeIndex } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';

const invite = (over: Partial<PendingInvitation> = {}): PendingInvitation => ({
  id: 'i1',
  teamId: 't9',
  teamName: 'Ops Crew',
  organisation: 'Acme',
  role: 'admin',
  invitedByName: 'Ann',
  memberCount: 3,
  createdAt: Date.now() - 5 * 60_000,
  ...over,
});

function fakeTeams(invitations: PendingInvitation[]) {
  const answer = vi.fn(
    async (id: string, accept: boolean): Promise<{ ok: true; value: AnsweredInvitation }> => ({
      ok: true,
      value: { teamId: 't9', teamName: 'Ops Crew', status: accept ? 'joined' : 'declined' },
    }),
  );
  const onTeamsChanged = vi.fn();
  const host = {
    myTeams: vi.fn(async () => ({ teams: [], invitations })),
    team: async () => null,
    answer,
    onTeamsChanged,
  } as unknown as TeamsHost;
  return { host, answer, onTeamsChanged };
}

function page(view: ExplorerView, invitations: PendingInvitation[], onNavigate = vi.fn()) {
  const teams = fakeTeams(invitations);
  render(
    <Explorer
      app="livediagram"
      client={createFakeIndex({}).client}
      view={view}
      onNavigate={onNavigate}
      itemHref={(i) => `/d/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
      teamsHost={teams.host}
    />,
  );
  return { onNavigate, ...teams };
}

describe('Invites', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => teamChanges.reset());

  it('shows a card per invitation, with Accept and Decline', async () => {
    page({ kind: 'invites' }, [invite()]);
    expect(await screen.findByText('Ops Crew')).toBeTruthy();
    expect(screen.getByText('Acme · 3 members')).toBeTruthy();
    expect(screen.getByText(/^Ann invited you .*, as an admin\.$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept the invitation to Ops Crew' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline the invitation to Ops Crew' })).toBeTruthy();
  });

  it('accepts in place: the team joins the sidebar and opens', async () => {
    const { onNavigate, answer, onTeamsChanged } = page({ kind: 'invites' }, [invite()]);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Accept the invitation to Ops Crew' }),
    );
    await waitFor(() => expect(answer).toHaveBeenCalledWith('i1', true));
    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith({ kind: 'team', id: 't9' }, '/explorer/team?id=t9'),
    );
    expect(onTeamsChanged).toHaveBeenCalled();
    expect(await screen.findByText('You joined Ops Crew.')).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /Ops Crew/ })).toBeTruthy();
  });

  it('declines in place: the card goes', async () => {
    const { answer } = page({ kind: 'invites' }, [invite()]);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Decline the invitation to Ops Crew' }),
    );
    await waitFor(() => expect(answer).toHaveBeenCalledWith('i1', false));
    expect(await screen.findByText('You declined the invitation to Ops Crew.')).toBeTruthy();
    expect(await screen.findByText('No pending invites')).toBeTruthy();
  });

  it('says so when none wait, and keeps its sidebar row while open', async () => {
    page({ kind: 'invites' }, []);
    expect(await screen.findByText('No pending invites')).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: 'Invites' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('opens from the sidebar row', async () => {
    const { onNavigate } = page({ kind: 'all' }, [invite()]);
    const row = await screen.findByRole('treeitem', { name: 'Invites (1 waiting)' });
    fireEvent.click(row.querySelector('[data-tree-activate]')!);
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'invites' }, '/explorer/invites');
  });
});
