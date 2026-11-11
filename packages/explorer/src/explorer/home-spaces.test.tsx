// Home's Spaces (liveworkspace/docs/specs/004-index/one-explorer.md "Spaces, on Home"): My Work then each team, the
// latest changed first, each a link into its list with its count and last change, from one request for every space,
// in the filtered app's words; its placeholders, its failed read, its invitations, its overflow and livehuddle's title.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SpacePreview } from '@liveworkspace/index-client';
import { IndexError } from '@liveworkspace/index-client';
import type { TeamsHost } from '../data/teams';
import { createFakeIndex, makeItem, type FakeIndex } from '../test/fakeClient';
import type { TeamRef } from '../types';
import { Explorer } from './Explorer';
import {
  orderSpaces,
  spaceCount,
  spaceFaces,
  spaceLine,
  SPACE_TONES,
  spaceTone,
  MY_WORK_TONE,
} from './home-spaces';

const HOUR = 3_600_000;
const preview = (teamId: string | null, updatedAt: number[], itemCount = updatedAt.length) =>
  ({
    teamId,
    itemCount,
    items: updatedAt.map((at, k) => makeItem(k, { teamId, updatedAt: at })),
  }) satisfies SpacePreview;

const WORDS = { lowerOne: 'plan', lowerMany: 'plans' };

describe('the order and the words', () => {
  it('puts My Work first, then the latest changed team, then the empty ones by name', () => {
    const teams: TeamRef[] = [
      { id: 'z', name: 'Zebra' },
      { id: 'a', name: 'apple' },
      { id: 'old', name: 'Old' },
      { id: 'new', name: 'New' },
      { id: 'b', name: 'Banana' },
    ];
    const byTeam = new Map([
      [null, preview(null, [])],
      ['old', preview('old', [10])],
      ['new', preview('new', [50])],
      ['z', preview('z', [])],
    ]);
    expect(orderSpaces(teams, byTeam).map((s) => s.name)).toEqual([
      'My Work',
      'New',
      'Old',
      'apple',
      'Banana',
      'Zebra',
    ]);
    // Before any answer: My Work, then the teams by name.
    expect(orderSpaces(teams, null).map((s) => s.teamId)).toEqual([
      null,
      'a',
      'b',
      'new',
      'old',
      'z',
    ]);
    expect(orderSpaces([], null)).toEqual([{ teamId: null, name: 'My Work', preview: null }]);
  });

  it('counts, caps and says when the newest changed', () => {
    expect(spaceCount(0, WORDS)).toBe('No plans yet');
    expect(spaceCount(1, WORDS)).toBe('1 plan');
    expect(spaceCount(12, WORDS)).toBe('12 plans');
    expect(spaceCount(1000, WORDS)).toBe('1000+ plans');
    const now = 10 * HOUR;
    expect(spaceLine(preview(null, [now - 2 * HOUR], 3), WORDS, now)).toBe(
      '3 plans · Edited 2 hours ago',
    );
    expect(spaceLine(preview(null, [now], 3), WORDS, null)).toBe('3 plans');
    expect(spaceLine(preview(null, []), WORDS, now)).toBe('No plans yet');
  });

  it('keeps a team on one tone, from the palette, and My Work on its sky', () => {
    expect(spaceTone(null)).toBe(MY_WORK_TONE);
    expect(spaceTone('team-1')).toBe(spaceTone('team-1'));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => spaceTone(`team-${i}`)));
    for (const tone of seen) expect(SPACE_TONES).toContain(tone);
    expect(seen.size).toBeGreaterThan(3);
  });

  it('shows the people behind the newest items, each once, the viewer left out, three at most', () => {
    const p: SpacePreview = {
      teamId: 't',
      itemCount: 5,
      items: ['me', 'ann', 'ann', 'bo', 'cy', 'di'].map((ownerId, k) => makeItem(k, { ownerId })),
    };
    expect(spaceFaces(p, 'me')).toEqual(['ann', 'bo', 'cy']);
    expect(spaceFaces(null, 'me')).toEqual([]);
  });
});

function renderHome(
  index: FakeIndex,
  over: Partial<Parameters<typeof Explorer>[0]> = {},
): { onNavigate: ReturnType<typeof vi.fn> } {
  const onNavigate = vi.fn();
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={onNavigate}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
      {...over}
    />,
  );
  return { onNavigate };
}

// The sidebar's Spaces group has a heading of the same name: Home's section is found by its own mark.
const section = async () => {
  await waitFor(() => expect(document.querySelector('[data-home-section="spaces"]')).toBeTruthy());
  return document.querySelector<HTMLElement>('[data-home-section="spaces"]')!;
};
const tiles = async () => {
  const s = await section();
  await waitFor(() => expect(s.querySelector('[data-space-tile]')).toBeTruthy());
  return within(s.querySelector('[data-home-spaces]') as HTMLElement);
};

function teamsHost(teams: { id: string; name: string; memberCount: number }[]): TeamsHost {
  return {
    myTeams: vi.fn(async () => ({ teams, invitations: [] })),
    team: vi.fn(async () => null),
    create: vi.fn(async ({ name }) => ({ ok: true as const, value: { id: 't-new', name } })),
    update: vi.fn(),
    remove: vi.fn(),
    invite: vi.fn(),
    setRole: vi.fn(),
    removeMember: vi.fn(),
    resetInviteLink: vi.fn(),
    clearInviteLink: vi.fn(),
    answer: vi.fn(),
  } as unknown as TeamsHost;
}

describe('Spaces on Home', () => {
  it('lists My Work then the teams, latest changed first, each a link into its list, from one request', async () => {
    const now = Date.now();
    const index = createFakeIndex({
      items: [
        makeItem(1, { updatedAt: now - 3 * HOUR }),
        makeItem(2, { updatedAt: now - 5 * HOUR }),
        makeItem(3, { teamId: 'design', updatedAt: now - 2 * HOUR, ownerId: 'user_ann' }),
        makeItem(4, { teamId: 'design', app: 'livediagram', kind: 'canvas', updatedAt: now }),
      ],
    });
    const teams = [
      { id: 'ops', name: 'Ops' },
      { id: 'design', name: 'Design' },
    ];
    const { onNavigate } = renderHome(index, { teams });
    const list = await tiles();
    const links = list.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual(['My Work', 'Design', 'Ops']);
    // This app's items only: Design's canvas is livediagram's.
    const describe = (l: HTMLElement) =>
      document.getElementById(l.getAttribute('aria-describedby')!)!.textContent;
    expect(describe(links[0]!)).toBe('2 plans · Edited 3 hours ago');
    expect(describe(links[1]!)).toBe('1 plan · Edited 2 hours ago');
    expect(describe(links[2]!)).toBe('No plans yet');
    expect(links[1]!.querySelector('[data-space-faces="1"]')).toBeTruthy();
    expect(index.count('spacePreviews')).toBe(1);
    expect(index.calls.find((c) => c.method === 'spacePreviews')!.args[0]).toEqual({
      app: 'liveplanner',
    });

    fireEvent.click(links[1]!);
    expect(onNavigate).toHaveBeenLastCalledWith(
      { kind: 'team', id: 'design' },
      links[1]!.getAttribute('href'),
    );
    fireEvent.click(links[0]!);
    expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'all' }, links[0]!.getAttribute('href'));
    // A modified click keeps the link's own way.
    const before = onNavigate.mock.calls.length;
    fireEvent.click(links[2]!, { metaKey: true });
    expect(onNavigate.mock.calls.length).toBe(before);
  });

  it('under All Apps counts every app’s items as files', async () => {
    const index = createFakeIndex({
      items: [makeItem(1), makeItem(2, { app: 'livediagram', kind: 'canvas' })],
    });
    renderHome(index, { filter: 'all' });
    const list = await tiles();
    const mine = list.getByRole('link', { name: 'My Work' });
    expect(document.getElementById(mine.getAttribute('aria-describedby')!)!.textContent).toMatch(
      /^2 files · Edited /,
    );
    expect(index.calls.find((c) => c.method === 'spacePreviews')!.args[0]).toEqual({});
  });

  it('draws placeholders while it loads, then the tiles', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    index.hold.add('spacePreviews');
    renderHome(index, { teams: [{ id: 't1', name: 'Design' }] });
    const s = await section();
    expect(s.getAttribute('aria-busy')).toBe('true');
    expect(s.querySelectorAll('[data-home-spaces-skeleton] li')).toHaveLength(2);
    index.release();
    await waitFor(() => expect(s.querySelectorAll('[data-space-tile]')).toHaveLength(2));
    expect(s.getAttribute('aria-busy')).toBe('false');
  });

  it('keeps every tile when the read fails, says so, and Try again reads again', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    index.fail.set('spacePreviews', new IndexError(500, 'internal'));
    renderHome(index, { teams: [{ id: 't1', name: 'Design' }] });
    const s = await section();
    const alert = await within(s).findByRole('alert');
    expect(alert.textContent).toContain('Couldn’t load what’s in your spaces.');
    expect(
      within(s)
        .getAllByRole('link')
        .map((l) => l.getAttribute('aria-label')),
    ).toEqual(['My Work', 'Design']);
    index.fail.delete('spacePreviews');
    // Held, so the re-read's placeholders are seen apart from its answer: the alert goes the moment Try again is
    // pressed, long before the tiles come back, so waiting on the alert alone raced the answer on a slow runner.
    index.hold.add('spacePreviews');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(index.count('spacePreviews')).toBe(2));
    expect(within(s).queryByRole('alert')).toBeNull();
    expect(s.getAttribute('aria-busy')).toBe('true');
    index.release();
    const mine = await within(s).findByRole('link', { name: 'My Work' });
    expect(s.getAttribute('aria-busy')).toBe('false');
    expect(within(s).queryByRole('alert')).toBeNull();
    expect(document.getElementById(mine.getAttribute('aria-describedby')!)!.textContent).toMatch(
      /^1 plan · Edited /,
    );
  });

  it('with no team yet offers Create a Team, which opens New Team', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    renderHome(index, { teamsHost: teamsHost([]) });
    const s = await section();
    const create = await within(s).findByRole('button', { name: /Create a Team/ });
    expect(create.textContent).toContain('Work together on shared plans.');
    fireEvent.click(create);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('a team says how many are in it, once there is more than the person', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    renderHome(index, {
      teamsHost: teamsHost([
        { id: 't1', name: 'Design', memberCount: 4 },
        { id: 't2', name: 'Solo', memberCount: 1 },
      ]),
    });
    const list = await tiles();
    await waitFor(() => expect(list.getAllByRole('link')).toHaveLength(3));
    expect(list.getByRole('link', { name: 'Design' }).textContent).toContain('4 members');
    expect(list.getByRole('link', { name: 'Solo' }).textContent).not.toContain('members');
    expect(
      within(list.getByRole('link', { name: 'Design' })).getByText(', 4 members'),
    ).toBeTruthy();
    expect(list.queryByRole('button', { name: /Create a Team/ })).toBeNull();
  });

  it('a guest has My Work and the way to sign in', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    renderHome(index, { signedIn: false, signInHref: '/sign-in' });
    const s = await section();
    const signIn = await within(s).findByRole('link', { name: /Sign In to Work in Teams/ });
    expect(signIn.getAttribute('href')).toBe('/sign-in');
    expect(s.querySelectorAll('[data-space-tile]')).toHaveLength(1);
  });

  it('shows eight, then Show All in place, and Show Fewer folds them again', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    const teams = Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}` }));
    renderHome(index, { teams });
    const list = await tiles();
    expect(list.getAllByRole('link')).toHaveLength(7);
    const more = list.getByRole('button', { name: /Show All 10 Spaces/ });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(list.getAllByRole('link')).toHaveLength(10);
    fireEvent.click(list.getByRole('button', { name: /Show Fewer/ }));
    expect(list.getAllByRole('link')).toHaveLength(7);
  });

  it('on livehuddle, whose items are Spaces, is titled Workspaces', async () => {
    const index = createFakeIndex({
      items: [makeItem(1, { app: 'livehuddle', kind: 'space' })],
    });
    renderHome(index, { app: 'livehuddle' });
    const s = await section();
    expect(within(s).getByRole('heading', { level: 2 }).textContent).toBe('Workspaces');
    expect(s.getAttribute('aria-labelledby')).toBe(within(s).getByRole('heading').id);
    const list = await tiles();
    const mine = list.getByRole('link', { name: 'My Work' });
    expect(document.getElementById(mine.getAttribute('aria-describedby')!)!.textContent).toMatch(
      /^1 space · Edited /,
    );
  });
});
