// @vitest-environment jsdom
// Settings › Calls › Calls Open In (liveworkspace/docs/specs/004-index/item-calls.md "Your Calls Space"): Default or
// one of the person's own or their teams' livehuddle Spaces, each with its preview; a choice they can't use any more
// shows as Unavailable; nothing shared with them through a link is offered.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALL_SPACES_LISTED, type Item } from '@liveworkspace/index-client';
import { CallSpacePanel } from './CallSpacePanel';
import { choosableSpaces, isUnavailable, matchesSpace } from './call-spaces';

const space = (id: string, over: Partial<Item> = {}): Item => ({
  id,
  app: 'livehuddle',
  kind: 'space',
  title: `Room ${id}`,
  ownerId: 'user_ada',
  teamId: null,
  folderId: null,
  source: null,
  intent: null,
  createdAt: 1,
  updatedAt: 10,
  trashedAt: null,
  trashReason: null,
  archivedAt: null,
  summary: {} as Item['summary'],
  access: 'edit',
  lastOpenedAt: null,
  sharedVia: null,
  ...over,
});

const host = (items: readonly Item[] | Error) => ({
  list: vi.fn(() => (items instanceof Error ? Promise.reject(items) : Promise.resolve(items))),
  token: vi.fn(async () => 'tok'),
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('png', { headers: { 'content-type': 'image/png' } }));
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('choosable Spaces', () => {
  it('keeps the person’s own and their teams’ live Spaces, newest change first', () => {
    const kept = choosableSpaces([
      space('a', { updatedAt: 1 }),
      space('b', { updatedAt: 5, teamId: 'team_1' }),
      space('shared', { sharedVia: 'code' }),
      space('viewed', { access: 'view' }),
      space('binned', { trashedAt: 3 }),
      space('shelved', { archivedAt: 3 }),
      space('doc', { app: 'livediagram' }),
    ]);
    expect(kept.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('calls a choice unavailable only when the whole list is in hand and lacks it', () => {
    expect(isUnavailable(null, [])).toBe(false);
    expect(isUnavailable('a', [space('a')])).toBe(false);
    expect(isUnavailable('gone', [space('a')])).toBe(true);
    const full = Array.from({ length: CALL_SPACES_LISTED }, (_, i) => space(`s${i}`));
    expect(isUnavailable('gone', full)).toBe(false);
  });

  it('finds a Space by its name', () => {
    expect(matchesSpace({ title: 'Team Room' }, ' room ')).toBe(true);
    expect(matchesSpace({ title: '' }, 'untitled')).toBe(true);
    expect(matchesSpace({ title: 'Team Room' }, 'kitchen')).toBe(false);
  });
});

describe('CallSpacePanel', () => {
  it('offers Default and each Space, and writes the choice', async () => {
    const onChange = vi.fn();
    const spaces = host([
      space('a', { title: 'Standup' }),
      space('b', { teamId: 't', title: 'Guild' }),
    ]);
    render(<CallSpacePanel spaces={spaces} value={null} onChange={onChange} />);
    const group = await screen.findByRole('radiogroup', { name: 'Calls Open In' });
    expect(within(group).getByRole('radio', { name: 'A New Space for Each Call' })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.getByText('Your Space')).toBeTruthy();
    expect(screen.getByText('Team Space')).toBeTruthy();
    fireEvent.click(within(group).getByRole('radio', { name: 'Guild' }));
    expect(onChange).toHaveBeenLastCalledWith('b');
  });

  it('shows the chosen Space as chosen, and Default writes null', async () => {
    const onChange = vi.fn();
    render(
      <CallSpacePanel
        spaces={host([space('a', { title: 'Standup' })])}
        value="a"
        onChange={onChange}
      />,
    );
    const chosen = await screen.findByRole('radio', { name: 'Standup' });
    expect(chosen).toHaveProperty('checked', true);
    expect(screen.queryByText('Unavailable')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'A New Space for Each Call' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('says a choice that can’t be used is Unavailable', async () => {
    render(<CallSpacePanel spaces={host([space('a')])} value="gone" onChange={() => {}} />);
    expect(await screen.findByText('Unavailable')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/deleted, or you can no longer use it/);
    expect(screen.getByRole('radio', { name: 'A New Space for Each Call' })).toHaveProperty(
      'checked',
      false,
    );
  });

  it('points to livehuddle when there are no Spaces yet', async () => {
    render(<CallSpacePanel spaces={host([])} value={null} onChange={() => {}} />);
    const link = await screen.findByRole('link', { name: 'Make one in livehuddle' });
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('says when the Spaces can’t be read, and tries again', async () => {
    const spaces = host(new Error('503'));
    render(<CallSpacePanel spaces={spaces} value={null} onChange={() => {}} />);
    const again = await screen.findByRole('button', { name: 'Try Again' });
    spaces.list.mockResolvedValueOnce([space('a', { title: 'Standup' })]);
    fireEvent.click(again);
    expect(await screen.findByRole('radio', { name: 'Standup' })).toBeTruthy();
  });

  it('draws each Space’s preview, asked with the bearer, and lets them go with the panel', async () => {
    const { container, unmount } = render(
      <CallSpacePanel
        spaces={host([space('a'), space('empty', { summary: { empty: true } as Item['summary'] })])}
        value={null}
        onChange={() => {}}
      />,
    );
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toMatch(/^\/api\/previews\/items\/a\?v=10&appearance=(light|dark)$/);
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('keeps the stand-in where a preview is refused, not an image, or there is no bearer', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
      );
    const { container } = render(
      <CallSpacePanel spaces={host([space('a'), space('b')])} value={null} onChange={() => {}} />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await screen.findByRole('radio', { name: 'Room a' });
    expect(container.querySelectorAll('img')).toHaveLength(0);
    cleanup();
    fetchMock.mockClear();
    const signedOut = { ...host([space('c')]), token: vi.fn(async () => null) };
    render(<CallSpacePanel spaces={signedOut} value={null} onChange={() => {}} />);
    await screen.findByRole('radio', { name: 'Room c' });
    await waitFor(() => expect(signedOut.token).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('finds a Space by name once there are many, and shows them all on asking', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      space(`s${i}`, { title: `Room ${i}`, updatedAt: 100 - i }),
    );
    render(<CallSpacePanel spaces={host(many)} value={null} onChange={() => {}} />);
    await screen.findByRole('radio', { name: 'Room 0' });
    expect(screen.queryByRole('radio', { name: 'Room 11' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show All 12 Spaces' }));
    expect(await screen.findByRole('radio', { name: 'Room 11' })).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a Space' }), {
      target: { value: 'Room 1' },
    });
    await waitFor(() => expect(screen.queryByRole('radio', { name: 'Room 2' })).toBeNull());
    expect(screen.getByRole('radio', { name: 'Room 10' })).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a Space' }), {
      target: { value: 'kitchen' },
    });
    expect(await screen.findByText('No Space is called that.')).toBeTruthy();
  });
});
