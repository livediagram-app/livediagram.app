// The Invites view (livediagram's TeamInvitesPane): a card per invitation waiting, answered on Manage Teams.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerAccounts, PendingInvitation } from '../data/accounts';
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

const accounts = (invitations: PendingInvitation[]): ExplorerAccounts => ({
  teamMembers: async () => null,
  myTeams: async () => ({ teams: [], invitations }),
  people: async () => new Map(),
});

function page(view: ExplorerView, invitations: PendingInvitation[], onNavigate = vi.fn()) {
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
      manageTeamsUrl="https://liveworkspace.app/account/teams"
      accounts={accounts(invitations)}
    />,
  );
  return onNavigate;
}

describe('Invites', () => {
  beforeEach(() => localStorage.clear());

  it('shows a card per invitation, answered on Manage Teams', async () => {
    page({ kind: 'invites' }, [invite()]);
    expect(await screen.findByText('Ops Crew')).toBeTruthy();
    expect(screen.getByText('Acme · 3 members')).toBeTruthy();
    expect(screen.getByText(/^Ann invited you .*, as an admin\.$/)).toBeTruthy();
    const answer = screen.getByRole('link', { name: 'Answer the invitation to Ops Crew' });
    expect(answer.getAttribute('href')).toBe('https://liveworkspace.app/account/teams#invitations');
  });

  it('says so when none wait, and keeps its sidebar row while open', async () => {
    page({ kind: 'invites' }, []);
    expect(await screen.findByText('No pending invites')).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: 'Invites' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('opens from the sidebar row', async () => {
    const onNavigate = page({ kind: 'all' }, [invite()]);
    const row = await screen.findByRole('treeitem', { name: 'Invites (1 waiting)' });
    fireEvent.click(row.querySelector('[data-tree-activate]')!);
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'invites' }, '/explorer/invites');
  });
});
