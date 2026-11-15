// @vitest-environment jsdom
// The mini view's content (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md
// "Rows"): the people, who speaks, raised hands, a knock, and Back to Space, for every share role.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { peerAvatarConfig } from '@livehuddle/avatar/config';
import type { AvatarPresence } from '@livehuddle/api-schema';
import {
  receiveCallOp,
  resetCallPeers,
  resetCallSelf,
  setCallSelf,
  VOICE_STALE_MS,
} from '@/lib/calls/calls-store';
import { resetMiniKnock, showMiniKnock } from '@/lib/mini-view/mini-view-knock';
import { miniViewPeople } from '@/lib/mini-view/mini-view-people';
import { ALONE_TEXT, MiniView } from './MiniView';
import { miniRowLabel } from './MiniViewRow';

const config = peerAvatarConfig(undefined);
const self = { name: 'Me', color: '#0ea5e9', config, status: null };
const row = (id: string, name: string, status?: string) => ({
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
    status,
  } as AvatarPresence,
});
const rows = [row('a', 'Sam', 'focus'), row('b', 'Ana')];

function show(heard: ReadonlySet<string> = new Set(), list = rows, doNotDisturb = false) {
  const { count, groups } = miniViewPeople({ self, rows: list, heard });
  return render(<MiniView count={count} groups={groups} tabId="t1" doNotDisturb={doNotDisturb} />);
}

const person = (name: string) => screen.getByRole('listitem', { name: new RegExp(`^${name}`) });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  act(() => {
    resetCallPeers();
    resetCallSelf();
    resetMiniKnock();
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MiniView', () => {
  it('heads the window with In the Space and the count, then you and everyone by name', () => {
    show();
    expect(screen.getByText('In the Space', { selector: 'header span' })).toBeTruthy();
    expect(screen.getByLabelText('3 people')).toBeTruthy();
    const names = screen.getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
    expect(names).toEqual(['You', 'Ana', 'Sam, Focusing']);
    expect(screen.queryByText(ALONE_TEXT)).toBeNull();
  });

  it('leads with Near You while you hear someone', () => {
    show(new Set(['a']));
    const near = screen.getByRole('region', { name: 'Near You' });
    expect(
      within(near)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label')),
    ).toEqual(['You', 'Sam, Focusing']);
    const rest = screen.getByRole('region', { name: 'In the Space' });
    expect(within(rest).getAllByRole('listitem')).toHaveLength(1);
  });

  it('says so when you are alone', () => {
    show(new Set(), []);
    expect(screen.getByLabelText('1 person')).toBeTruthy();
    expect(screen.getByText(ALONE_TEXT)).toBeTruthy();
  });

  it('shows who speaks with bars and a ring, until the level goes stale', () => {
    const { container } = show();
    act(() => {
      receiveCallOp('a', { kind: 'avatar-voice', tabId: 't1', level: 3 });
      vi.advanceTimersByTime(100);
    });
    expect(person('Sam').getAttribute('aria-label')).toBe('Sam, Focusing, speaking');
    expect(container.querySelector('[data-mini-person="a"] [data-speaking]')).toBeTruthy();
    expect(container.querySelector('[data-mini-person="b"] [data-speaking]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(VOICE_STALE_MS + 200);
    });
    expect(person('Sam').getAttribute('aria-label')).toBe('Sam, Focusing');
  });

  it('hides everyone else’s speaking under Do Not Disturb', () => {
    show(new Set(), rows, true);
    act(() => {
      receiveCallOp('a', { kind: 'avatar-voice', tabId: 't1', level: 3 });
      vi.advanceTimersByTime(100);
    });
    expect(person('Sam').getAttribute('aria-label')).toBe('Sam, Focusing');
  });

  it('shows a raised hand on its tab, and the microphone once let speak', () => {
    show();
    act(() => receiveCallOp('b', { kind: 'avatar-hand', tabId: 't1', raised: true }));
    expect(person('Ana').getAttribute('aria-label')).toBe('Ana, hand raised');
    act(() =>
      receiveCallOp('b', { kind: 'avatar-hand', tabId: 't1', raised: true, letSpeak: 'x' }),
    );
    expect(person('Ana').getAttribute('aria-label')).toBe('Ana, let speak');
    // A hand on another tab is not this tab's.
    act(() => receiveCallOp('a', { kind: 'avatar-hand', tabId: 't2', raised: true }));
    expect(person('Sam').getAttribute('aria-label')).toBe('Sam, Focusing');
  });

  // Share roles: an Editor or a Participant speaks and raises a hand; a Viewer's own row shows neither level nor hand.
  it.each([
    ['an Editor', { canSpeak: true, canShare: true }, 'You, hand raised, speaking'],
    ['a Participant', { canSpeak: true, canShare: false }, 'You, hand raised, speaking'],
  ])('shows your own level and hand for %s', (_role, can, label) => {
    show();
    act(() =>
      setCallSelf({ ...can, phase: 'live', mic: 'open', muted: false, level: 2, hand: 'raised' }),
    );
    expect(person('You').getAttribute('aria-label')).toBe(label);
  });

  it('shows a Viewer’s own row without a level', () => {
    show();
    act(() => setCallSelf({ canSpeak: false, phase: 'live', mic: 'open', muted: false, level: 2 }));
    expect(person('You').getAttribute('aria-label')).toBe('You');
    // Muted, or the hand let speak, as your row reads them.
    act(() => setCallSelf({ canSpeak: true, muted: true, hand: 'speaking' }));
    expect(person('You').getAttribute('aria-label')).toBe('You, let speak');
  });

  it('shows a knock with Let In and Not Now, answering through the toast’s own answer', () => {
    show();
    const answer = vi.fn();
    act(() => showMiniKnock({ from: 'a', name: 'Sam', answer }));
    expect(screen.getByText('Sam is knocking')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Let In' }));
    expect(answer).toHaveBeenLastCalledWith('in');
    fireEvent.click(screen.getByRole('button', { name: 'Not Now' }));
    expect(answer).toHaveBeenLastCalledWith('later');
    expect(document.querySelector('[aria-live="polite"] [data-mini-knock]')).toBeTruthy();
  });

  it('brings the Space’s tab to the front from Back to Space, the header or a row, never twice', () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Space' }));
    expect(focus).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('In the Space', { selector: 'header span' }));
    expect(focus).toHaveBeenCalledTimes(2);
    fireEvent.click(person('Ana'));
    expect(focus).toHaveBeenCalledTimes(3);
  });
});

describe('miniRowLabel', () => {
  it('reads name, status, hand and speaking in that order', () => {
    const p = {
      id: 'a',
      name: 'Sam',
      color: '#000',
      config,
      status: 'focus' as const,
      self: false,
    };
    expect(miniRowLabel(p, 'raised', true)).toBe('Sam, Focusing, hand raised, speaking');
    expect(miniRowLabel({ ...p, status: null }, null, false)).toBe('Sam');
  });
});
