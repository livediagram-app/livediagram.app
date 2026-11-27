// A team's Library toolbar on a phone (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page", Work
// Tracker 1516): one row of the scope chip, Sort as an icon and New, Help moved to the team's ⋯ menu; a wider screen
// keeps the toolbar it had.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamDetails, TeamsHost } from '../data/teams';
import { teamChanges } from '../data/teamChanges';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';

const team: TeamDetails = {
  team: { id: 't1', name: 'Web', organisation: null, myRole: 'member', myMemberId: 'm2' },
  members: [
    { id: 'm1', userId: 'user_a', email: 'a@x.test', name: 'Ann', role: 'admin', status: 'joined' },
    {
      id: 'm2',
      userId: 'user_me',
      email: 'me@x.test',
      name: 'Me',
      role: 'member',
      status: 'joined',
    },
  ],
  inviteLink: null,
};

// The page reads the person's teams and the team's members; nothing else is asked of the host here.
const host = {
  myTeams: async () => ({ teams: [{ id: 't1', name: 'Web', memberCount: 2 }], invitations: [] }),
  team: async () => team,
  onTeamsChanged: () => {},
} as unknown as TeamsHost;

function phone(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

async function library(extra: Partial<React.ComponentProps<typeof Explorer>> = {}) {
  render(
    <Explorer
      app="liveplanner"
      client={createFakeIndex({ items: [makeItem(1, { teamId: 't1' })] }).client}
      view={{ kind: 'team', id: 't1' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
      teams={[{ id: 't1', name: 'Web' }]}
      teamsHost={host}
      allLabel="All Apps"
      helpHref={() => 'https://liveplanner.app/help/teams/'}
      {...extra}
    />,
  );
  await screen.findByText('Item 1');
}

describe('a team’s Library toolbar', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    teamChanges.reset();
  });

  it('is one row on a phone: the scope chip, Sort and New, with no Help in it', async () => {
    phone(true);
    await library();
    const row = document.querySelector<HTMLElement>('[data-phone-toolbar]')!;
    expect(row.className).toContain('flex-nowrap');
    const controls = within(row).getAllByRole('button');
    expect(controls.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Show: liveplanner',
      'Sort: Last Changed',
      'New',
    ]);
    expect(within(row).queryByRole('link', { name: /Help/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
    // New keeps its menu.
    fireEvent.click(within(row).getByRole('button', { name: 'New' }));
    expect(await screen.findByRole('menu', { name: 'Create' })).toBeTruthy();
  });

  it('switches between this app and All Apps from the scope chip’s sheet', async () => {
    phone(true);
    await library({ renderAppLogo: (app) => <i data-logo={app} /> });
    const chip = screen.getByRole('button', { name: 'Show: liveplanner' });
    expect(chip.querySelector('[data-logo="liveplanner"]')).not.toBeNull();
    fireEvent.focus(chip);
    fireEvent.pointerDown(chip);
    fireEvent.click(chip);
    const sheet = await screen.findByRole('dialog', { name: 'Show' });
    expect(
      within(sheet).getByRole('radio', { name: 'liveplanner' }).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(within(sheet).getByRole('radio', { name: 'All Apps' }));
    const all = await screen.findByRole('button', { name: 'Show: All Apps' });
    expect(all.querySelector('[data-logo="all"]')).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('leaves the chip out where the host shows no app switch', async () => {
    phone(true);
    await library({ showAppFilter: false });
    const row = document.querySelector<HTMLElement>('[data-phone-toolbar]')!;
    expect(within(row).queryByRole('button', { name: /^Show:/ })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Sort: Last Changed' })).toBeTruthy();
  });

  it('moves Help into the team’s ⋯ menu on a phone', async () => {
    phone(true);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await library();
    fireEvent.click(screen.getByRole('button', { name: 'Web options' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Help' }));
    expect(open).toHaveBeenCalledWith(
      'https://liveplanner.app/help/teams/',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('keeps the wider toolbar on a larger screen: the switch, Help in the row, none in the menu', async () => {
    phone(false);
    await library();
    expect(document.querySelector('[data-phone-toolbar]')).toBeNull();
    expect(screen.getByRole('group', { name: 'Show' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Help/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Web options' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Help' })).toBeNull();
  });
});
