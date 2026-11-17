// @vitest-environment jsdom
// The mini view's camera tiles (docs/specs/008-canvas/avatar-mode.md "The mini view", "Camera tiles"; blueprint:
// space-mini-view.md "Camera tiles", Work Tracker 984): the received cameras of the people you hear, by name, not
// yours, capped, laid out two to a row, and a press back to the Space.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { peerAvatarConfig } from '@livehuddle/avatar/config';
import type { AvatarPresence } from '@livehuddle/api-schema';
import { MAX_MINI_VIEW_VIDEOS } from '@/lib/calls/bubbles';
import {
  receiveCallOp,
  resetCallMedia,
  resetCallPeers,
  setCallMedia,
} from '@/lib/calls/calls-store';
import { miniViewPeople, type MiniGroup } from '@/lib/mini-view/mini-view-people';
import { MiniView } from './MiniView';
import { miniTiles, MiniViewTiles, TILES_LABEL } from './MiniViewTiles';

const config = peerAvatarConfig(undefined);
const self = { name: 'Me', color: '#0ea5e9', config, status: null };
const row = (id: string, name: string) => ({
  id,
  name,
  color: '#f43f5e',
  avatar: {
    x: 0,
    y: 0,
    facing: 'down',
    walking: false,
    stepFrame: 0,
    lift: 0,
    wave: null,
  } as AvatarPresence,
});
const stream = (id: string) => ({ id }) as unknown as MediaStream;
const people = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => row(id, `P${i}`));

function groupsOf(heard: readonly string[], rows = people): readonly MiniGroup[] {
  return miniViewPeople({ self, rows, heard: new Set(heard) }).groups;
}

function show(heard: readonly string[], doNotDisturb = false) {
  const { count, groups } = miniViewPeople({ self, rows: people, heard: new Set(heard) });
  return render(<MiniView count={count} groups={groups} tabId="t1" doNotDisturb={doNotDisturb} />);
}

const tiles = () =>
  within(screen.getByRole('list', { name: TILES_LABEL })).getAllByRole('listitem');

afterEach(() => {
  cleanup();
  act(() => {
    resetCallMedia();
    resetCallPeers();
  });
  vi.restoreAllMocks();
});

describe('miniTiles', () => {
  it('takes Near You in order, skips you and anyone without a received camera', () => {
    const media = new Map([
      ['self', { video: stream('mine') }],
      ['c', { video: stream('c') }],
      ['a', { video: stream('a') }],
      ['b', { screen: stream('b') }],
      ['e', { video: stream('e') }],
    ]);
    const picked = miniTiles(groupsOf(['a', 'b', 'c']), media);
    expect(picked.map((t) => t.person.id)).toEqual(['a', 'c']);
    expect(picked[0]!.stream).toBe(media.get('a')!.video);
  });

  it('none without Near You or without a camera, the same empty answer each time', () => {
    const media = new Map([['a', { video: stream('a') }]]);
    expect(miniTiles(groupsOf([]), media)).toHaveLength(0);
    expect(miniTiles(groupsOf(['b']), media)).toBe(miniTiles(groupsOf([]), new Map()));
  });

  it(`stops at ${MAX_MINI_VIEW_VIDEOS}`, () => {
    const all = people.map((p) => p.id);
    const media = new Map(all.map((id) => [id, { video: stream(id) }]));
    expect(miniTiles(groupsOf(all), media).map((t) => t.person.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('MiniViewTiles', () => {
  it('draws nothing with no tile', () => {
    const { container } = render(<MiniViewTiles tiles={[]} levelOf={() => 0} />);
    expect(container.innerHTML).toBe('');
  });

  it('in the mini view: a Cameras list of the heard cameras, named, above the people', () => {
    act(() => {
      setCallMedia('a', 'video', stream('a'));
      setCallMedia('b', 'video', stream('b'));
      setCallMedia('d', 'video', stream('d'));
    });
    show(['a', 'b']);
    expect(tiles().map((li) => li.getAttribute('data-mini-tile'))).toEqual(['a', 'b']);
    expect(screen.getByRole('button', { name: "P0's Camera" })).toBeTruthy();
    // The pair shares a row; neither spans it.
    expect(tiles().map((li) => li.className)).toEqual(['', '']);
    const video = tiles()[0]!.querySelector('video')!;
    expect((video.srcObject as unknown as { id: string }).id).toBe('a');
    // Above the people's lists.
    const list = screen.getByRole('list', { name: TILES_LABEL });
    const near = screen.getByRole('region', { name: 'Near You' });
    expect(list.compareDocumentPosition(near) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a camera arriving or going adds or removes its tile; none leaves no list', () => {
    show(['a', 'b']);
    expect(screen.queryByRole('list', { name: TILES_LABEL })).toBeNull();
    act(() => setCallMedia('b', 'video', stream('b')));
    expect(tiles()).toHaveLength(1);
    // A lone tile fills the row.
    expect(tiles()[0]!.className).toBe('col-span-2');
    act(() => setCallMedia('b', 'video', null));
    expect(screen.queryByRole('list', { name: TILES_LABEL })).toBeNull();
  });

  it('an odd last tile sits centred at one column', () => {
    act(() => {
      for (const id of ['a', 'b', 'c']) setCallMedia(id, 'video', stream(id));
    });
    show(['a', 'b', 'c']);
    const [first, , last] = tiles();
    expect(first!.className).toBe('');
    expect(last!.className).toContain('justify-self-center');
  });

  it('says who speaks, unless Do Not Disturb', () => {
    vi.useFakeTimers();
    act(() => setCallMedia('a', 'video', stream('a')));
    show(['a']);
    act(() => {
      receiveCallOp('a', { kind: 'avatar-voice', tabId: 't1', level: 3 });
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('button', { name: "P0's Camera, speaking" })).toBeTruthy();
    cleanup();
    show(['a'], true);
    expect(screen.getByRole('button', { name: "P0's Camera" })).toBeTruthy();
    vi.useRealTimers();
  });

  it('a press brings the Space to the front', () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
    act(() => setCallMedia('a', 'video', stream('a')));
    show(['a']);
    fireEvent.click(screen.getByRole('button', { name: "P0's Camera" }));
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
