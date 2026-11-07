// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ArcadeScore, type ShapeElement } from '@livehuddle/document';
import { avatarKeyClaimed } from '@liveworkspace/avatar/key-claims';
import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';

// docs/specs/009-elements/social-pieces.md "The panel", "Controls", "High Scores"; blueprint "The panel": the panel
// as one screen plays it, with the model's hop and steps watched and a run's end forced, so a test plays in moments.

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const editor = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => editor.value,
}));
const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('@livehuddle/ui', async (actual) => ({
  ...(await actual<typeof import('@livehuddle/ui')>()),
  useMediaQuery: () => reduced.on,
  prefersReducedMotion: () => reduced.on,
}));
// The next step ends the run with this score, or gives it this score without ending it.
const forced = vi.hoisted(() => ({
  end: null as null | { score: number; ms: number; over: boolean },
}));
const hops = vi.hoisted(() => [] as string[]);
vi.mock('@/lib/arcade/moon-mail', async (actual) => {
  const real = await actual<typeof import('@/lib/arcade/moon-mail')>();
  return {
    ...real,
    hop: (run: Parameters<typeof real.hop>[0], dir: 'out' | 'in') => {
      hops.push(dir);
      return real.hop(run, dir);
    },
    advance: (run: Parameters<typeof real.advance>[0], dt: number) => {
      const n = real.advance(run, dt);
      if (forced.end) {
        Object.assign(run, forced.end);
        forced.end = null;
      }
      return n;
    },
  };
});

import ArcadePanel from './ArcadePanel';

const applyElementDelta = vi.fn();
function asRole(level: 'edit' | 'participate' | 'view') {
  editor.value = {
    can: { level },
    participating: level === 'participate',
    adderKey: level === 'view' ? null : 'k-me',
    selfParticipant: { id: 'me', name: 'Ann Example', color: '#ef4444' },
    activeTab: { id: 'tab-1' },
    applyElementDelta,
  };
}

const score = (id: string, value: number, by = 'k-bo', name = 'Bo'): ArcadeScore => ({
  id,
  name,
  score: value,
  ms: 600_000,
  by,
  at: Date.UTC(2026, 10, 5, 12),
});
const machine = (arcadeScores?: ArcadeScore[]): ShapeElement => ({
  ...createShape('arcade-machine', 0, 0),
  id: 'arc',
  ...(arcadeScores ? { arcadeScores } : {}),
});

// A context that draws nothing, so the painter runs its whole frame in jsdom.
const gradient = { addColorStop() {} };
const noopCtx = new Proxy(
  {},
  {
    get: (_t, key) => (key === 'createRadialGradient' ? () => gradient : () => undefined),
    set: () => true,
  },
);

const onClose = vi.fn();
const open = (el = machine()) => render(<ArcadePanel element={el} onClose={onClose} />);
const frames = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const key = (k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(window, { key: k, ...init });
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    noopCtx as unknown as CanvasRenderingContext2D,
  );
  asRole('participate');
  reduced.on = false;
  forced.end = null;
  hops.length = 0;
  applyElementDelta.mockClear();
  track.mockClear();
  onClose.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ArcadePanel', () => {
  it('opens on Moon Mail at rest, holds the keyboard and claims the game’s keys', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Moon Mail' })).toBeTruthy();
    expect(screen.getByText('Press Space or Tap to Start')).toBeTruthy();
    expect(anyModalOpen()).toBe(true);
    for (const k of ['ArrowUp', 'ArrowDown', 'w', 's', ' ', 'Enter', 'p'])
      expect(avatarKeyClaimed({ key: k })).toBe(true);
    expect(avatarKeyClaimed({ key: 'ArrowLeft' })).toBe(false);
    expect(avatarKeyClaimed({ key: 'w', metaKey: true })).toBe(false);
    cleanup();
    expect(anyModalOpen()).toBe(false);
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(false);
  });

  it('starts on Space and hops out and in on the arrows and W and S, one press one hop', () => {
    open();
    key(' ');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    frames(100);
    key('ArrowUp');
    key('s');
    key('w');
    key('ArrowDown', { repeat: true });
    expect(hops).toEqual(['out', 'in', 'out']);
  });

  it('pauses on P, on Space, on a hidden tab and on a lost focus, and resumes only when asked', () => {
    open();
    key('Enter');
    key('p');
    expect(screen.getByText('Paused')).toBeTruthy();
    key('p');
    expect(screen.queryByText('Paused')).toBeNull();
    key(' ');
    expect(screen.getByText('Paused')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByText('Paused')).toBeNull();
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(screen.getByText('Paused')).toBeTruthy();
    key('Enter');
    expect(screen.queryByText('Paused')).toBeNull();
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    hidden.mockRestore();
    expect(screen.getByText('Paused')).toBeTruthy();
    frames(5_000);
    expect(screen.getByText('Paused')).toBeTruthy();
  });

  it('starts, resumes and hops by a tap on the screen', () => {
    open();
    const scr = document.querySelector<HTMLElement>('[data-moon-mail-screen]')!;
    vi.spyOn(scr, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    } as DOMRect);
    fireEvent.pointerDown(scr, { clientX: 50, clientY: 50 });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    // The ship starts on the middle orbit: the corner is outside it, the moon inside.
    fireEvent.pointerDown(scr, { clientX: 2, clientY: 2 });
    fireEvent.pointerDown(scr, { clientX: 50, clientY: 50 });
    expect(hops).toEqual(['out', 'in']);
    key('p');
    fireEvent.pointerDown(scr, { clientX: 50, clientY: 50 });
    expect(screen.queryByText('Paused')).toBeNull();
  });

  it('posts a run that makes the table once, signed and named, and says where it landed', () => {
    open(machine([score('a', 50)]));
    key(' ');
    forced.end = { score: 120, ms: 30_000, over: true };
    frames(50);
    expect(screen.getByText('Game Over')).toBeTruthy();
    expect(screen.getByText('New High Score!')).toBeTruthy();
    expect(applyElementDelta).toHaveBeenCalledTimes(1);
    const [id, delta, tab] = applyElementDelta.mock.calls[0]!;
    expect(id).toBe('arc');
    expect(tab).toBe('tab-1');
    expect(delta).toMatchObject({
      kind: 'arcade-score',
      score: { name: 'Ann Example', score: 120, ms: 30_000, by: 'k-me' },
    });
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'Arcade');
    // No second post, however long the screen stays on Game Over.
    frames(1_000);
    expect(applyElementDelta).toHaveBeenCalledTimes(1);
    // Play Again starts a fresh run.
    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }));
    expect(screen.queryByText('Game Over')).toBeNull();
  });

  it('says You Placed #n below the top, and posts nothing that misses the table', () => {
    const full = Array.from({ length: 10 }, (_, i) => score(`r${i}`, 1_000 - i));
    open(machine([score('a', 500)]));
    key(' ');
    forced.end = { score: 120, ms: 30_000, over: true };
    frames(50);
    expect(screen.getByText('You Placed #2')).toBeTruthy();
    cleanup();
    applyElementDelta.mockClear();
    open(machine(full));
    key(' ');
    forced.end = { score: 120, ms: 30_000, over: true };
    frames(50);
    expect(screen.getByText('Game Over')).toBeTruthy();
    expect(screen.queryByRole('status', { name: /Placed|High Score/ })).toBeNull();
    expect(applyElementDelta).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('ends a run closed mid-play and posts its score; a run never started posts nothing', () => {
    open();
    key(' ');
    forced.end = { score: 40, ms: 9_000, over: false };
    frames(50);
    cleanup();
    expect(applyElementDelta).toHaveBeenCalledTimes(1);
    expect(applyElementDelta.mock.calls[0]![1]).toMatchObject({ score: { score: 40 } });
    applyElementDelta.mockClear();
    track.mockClear();
    open();
    cleanup();
    expect(applyElementDelta).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('pauses a run on a press beside the panel, and closes on one otherwise', () => {
    open();
    const dim = () =>
      document.querySelector<HTMLElement>('[data-arcade-panel]')!.parentElement!.firstElementChild!;
    key(' ');
    // Where the focus trap puts focus after a press outside it.
    document.querySelector<HTMLElement>('[data-arcade-panel] button')!.focus();
    fireEvent.click(dim());
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // Focus is back on the game, so Space resumes rather than pressing Close.
    expect(document.activeElement).toBe(document.querySelector('[data-moon-mail-screen]'));
    key(' ');
    expect(screen.queryByText('Paused')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    key('p');
    fireEvent.click(dim());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves a focused button its own Space and Enter', () => {
    open();
    const start = screen.getByRole('button', { name: 'Start' });
    start.focus();
    fireEvent.keyDown(start, { key: ' ' });
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    fireEvent.click(start);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('shows the High Scores best first with rank, name, You, score and day', () => {
    open(machine([score('a', 1_240, 'k-bo', 'Bo'), score('b', 300, 'k-me', 'Ann Example')]));
    const rows = [...document.querySelectorAll('[data-arcade-scores] li')].map(
      (li) => li.textContent,
    );
    expect(rows).toEqual(['1Bo1,2405 Nov', '2Ann ExampleYou3005 Nov']);
  });

  it('reads No Scores Yet on an empty table', () => {
    open();
    expect(screen.getByText('No Scores Yet')).toBeTruthy();
  });

  it('shows a Viewer the High Scores alone, with no game and no keys taken', () => {
    asRole('view');
    open(machine([score('a', 90)]));
    expect(screen.queryByText('Press Space or Tap to Start')).toBeNull();
    expect(document.querySelector('canvas')).toBeNull();
    expect(screen.getByText('Viewers See the Scores')).toBeTruthy();
    expect(screen.getByText('Bo')).toBeTruthy();
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(false);
    key(' ');
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('plays under reduced motion too', () => {
    reduced.on = true;
    open();
    key(' ');
    frames(500);
    key('ArrowUp');
    expect(hops).toEqual(['out']);
  });
});
