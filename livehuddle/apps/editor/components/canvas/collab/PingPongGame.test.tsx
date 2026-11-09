// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { avatarKeyClaimed } from '@livehuddle/avatar/key-claims';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('@livehuddle/ui', async (actual) => ({
  ...(await actual<typeof import('@livehuddle/ui')>()),
  useMediaQuery: () => reduced.on,
  prefersReducedMotion: () => reduced.on,
}));

import { receiveGameOp } from '@/lib/table-games/table-game-inbox';
import { setTableGameScene, type GameSignal } from '@/lib/table-games/table-game-scene';
import type { GameSeatSource } from '@/lib/table-games/game-seats';
import { PONG, serverAt, type Score } from '@/lib/table-games/ping-pong';
import { isPieceControlPress } from '@/lib/piece-control';
import { SocialArt } from './SocialArt';
import { PingPongGame, scoreboardText } from './PingPongGame';
import { framePointerAxis, pongFrame } from '@/lib/table-games/pong-frame';

// docs/specs/009-elements/social-pieces.md "A game", "Controls", "Reduced motion": the table as one screen draws it.

const table = (): ShapeElement => ({
  ...createShape('ping-pong-table', 0, 0),
  id: 'table',
});
const me = (seat: number | null, plays = true): GameSeatSource => ({
  id: 'me',
  name: 'You',
  color: '#ef4444',
  seatedOn: seat === null ? null : 'table',
  seat,
  plays,
});
const ann: GameSeatSource = {
  id: 'ann',
  name: 'Ann',
  color: '#3b82f6',
  seatedOn: 'table',
  seat: 1,
  plays: true,
};
const annInput = (axis = 0.5) => ({
  kind: 'game-input',
  tabId: 't',
  pieceId: 'table',
  seat: 1,
  axis,
});

let sent: GameSignal[] = [];
function seat(sources: GameSeatSource[]) {
  act(() =>
    setTableGameScene({ tabId: 't', selfId: 'me', sources, send: (op) => void sent.push(op) }),
  );
}
function frames(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  sent = [];
  reduced.on = false;
  vi.useFakeTimers({
    toFake: [
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'setInterval',
      'clearInterval',
    ],
  });
});
afterEach(() => {
  cleanup();
  act(() => setTableGameScene(null));
  vi.useRealTimers();
});

describe('PingPongGame', () => {
  it('draws nothing with a seat empty, and the rally rests as before', () => {
    seat([me(0)]);
    const { container } = render(
      <svg>
        <SocialArt kind="ping-pong-table" id="table" sitters={2} />
      </svg>,
    );
    render(<PingPongGame element={table()} />);
    frames(2_000);
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('[data-rally]')).not.toBeNull();
    expect(sent).toEqual([]);
  });

  it('reads Ready once both players can play, then serves and shows the score in place of the rally', () => {
    seat([me(0), ann]);
    const art = render(
      <svg>
        <SocialArt kind="ping-pong-table" id="table" sitters={2} />
      </svg>,
    );
    render(<PingPongGame element={table()} />);
    frames(50);
    // Your screen says it can play, as soon as both seats are held.
    expect(sent.map((o) => o.kind)).toEqual(['game-input']);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => receiveGameOp('ann', annInput()));
    expect(screen.getByRole('status').textContent).toBe('Ready');
    expect(art.container.querySelector('[data-rally]')).toBeNull();
    frames(PONG.servePauseMs + 100);
    expect(sent.some((o) => o.kind === 'game-event' && o.event === 'serve')).toBe(true);
    const score = screen.getByRole('status');
    expect(score.getAttribute('data-pong-score')).toBe('0-0');
    expect(score.textContent).toContain('You 0, Ann 0');
    // The ball flies: drawn through its ref, off the table's corner.
    const ball = document.querySelector('[data-pong-ball]')!;
    expect(ball.getAttribute('transform')).not.toBe('translate(-999 -999)');
  });

  it('ignores a peer op for another tab or table', () => {
    seat([me(0), ann]);
    render(<PingPongGame element={table()} />);
    frames(50);
    act(() => receiveGameOp('ann', { ...annInput(), tabId: 'other' }));
    act(() => receiveGameOp('ann', { ...annInput(), pieceId: 'other' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('takes W/S and Up/Down for your paddle while a game is on, and gives them back after', () => {
    seat([me(0), ann]);
    const view = render(<PingPongGame element={table()} />);
    frames(50);
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(false);
    act(() => receiveGameOp('ann', annInput()));
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(true);
    expect(avatarKeyClaimed({ key: 'w' })).toBe(true);
    expect(avatarKeyClaimed({ key: 'ArrowLeft' })).toBe(false);
    expect(avatarKeyClaimed({ key: 's', metaKey: true })).toBe(false);
    const paddle = () =>
      document.querySelector('[data-pong-paddle="0"]')!.getAttribute('transform');
    const before = paddle();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    frames(200);
    fireEvent.keyUp(window, { key: 'ArrowDown' });
    expect(paddle()).not.toBe(before);
    const moved = paddle();
    fireEvent.keyDown(window, { key: 'w' });
    frames(100);
    fireEvent(window, new Event('blur'));
    frames(100);
    expect(paddle()).not.toBe(moved);
    // Typing into a field moves nothing.
    const input = document.createElement('input');
    document.body.appendChild(input);
    const typed = paddle();
    fireEvent.keyDown(input, { key: 's' });
    frames(100);
    expect(paddle()).toBe(typed);
    input.remove();
    view.unmount();
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(false);
  });

  it('makes the table your paddle’s control: the pointer’s height moves it, and the press is the table’s', () => {
    seat([me(0), ann]);
    render(<PingPongGame element={table()} />);
    frames(50);
    act(() => receiveGameOp('ann', annInput()));
    const control = document.querySelector('[data-pong-control]')!;
    expect(isPieceControlPress(control)).toBe(true);
    const svg = document.querySelector('[data-pong]')!;
    svg.getBoundingClientRect = () => ({ top: 0, height: 112, left: 0, width: 184 }) as DOMRect;
    const paddle = () =>
      document.querySelector('[data-pong-paddle="0"]')!.getAttribute('transform');
    fireEvent.pointerDown(control, { clientY: 74, pointerId: 1 });
    frames(20);
    const low = paddle();
    fireEvent.pointerMove(control, { clientY: 30 });
    frames(20);
    expect(paddle()).not.toBe(low);
  });

  it('gives a watcher no control', () => {
    seat([me(null), { ...ann, id: 'bob', name: 'Bob', seat: 0 }, ann]);
    render(<PingPongGame element={table()} />);
    act(() => receiveGameOp('ann', annInput()));
    act(() => receiveGameOp('bob', { ...annInput(), seat: 0 }));
    expect(screen.getByRole('status').textContent).toBe('Ready');
    expect(document.querySelector('[data-pong-control]')).toBeNull();
    expect(sent).toEqual([]);
  });

  it('under reduced motion: a player reads Motion Reduced and sends nothing; a watcher sees the score only', () => {
    reduced.on = true;
    seat([me(0), ann]);
    const first = render(<PingPongGame element={table()} />);
    frames(2_000);
    expect(screen.getByRole('status').textContent).toBe('Motion Reduced');
    expect(sent).toEqual([]);
    first.unmount();

    seat([me(null), { ...ann, id: 'bob', name: 'Bob', seat: 0 }, ann]);
    render(<PingPongGame element={table()} />);
    act(() =>
      receiveGameOp('bob', {
        kind: 'game-event',
        tabId: 't',
        pieceId: 'table',
        seat: 0,
        game: 'ping-pong',
        match: 'm',
        seq: 1,
        event: 'serve',
        ball: { x: 0.04, y: 0.5, vx: 0.7, vy: 0 },
        score: [0, 0],
      }),
    );
    expect(screen.getByRole('status').getAttribute('data-pong-score')).toBe('0-0');
    expect(document.querySelector('[data-pong]')).toBeNull();
  });
  it('shows the winner in their colour once a game is won', () => {
    seat([me(null), { ...ann, id: 'bob', name: 'Bob', seat: 0 }, ann]);
    render(<PingPongGame element={table()} />);
    // Bob serves and Ann misses every ball, point by point, each from the seat whose moment it is.
    let score: Score = [0, 0];
    let seq = 0;
    const moment = (from: 'bob' | 'ann', extra: Record<string, unknown>) =>
      act(() =>
        receiveGameOp(from, {
          kind: 'game-event',
          tabId: 't',
          pieceId: 'table',
          seat: from === 'bob' ? 0 : 1,
          game: 'ping-pong',
          match: 'm',
          seq: (seq += 1),
          score,
          ...extra,
        }),
      );
    while (score[0] < 11) {
      const server = serverAt(score);
      const ball =
        server === 0 ? { x: 0.04, y: 0.5, vx: 0.7, vy: 0 } : { x: 0.96, y: 0.5, vx: -0.7, vy: 0 };
      moment(server === 0 ? 'bob' : 'ann', { event: 'serve', ball });
      if (server === 1) moment('bob', { event: 'hit', ball: { x: 0.04, y: 0.5, vx: 0.7, vy: 0 } });
      score = [score[0] + 1, score[1]];
      moment('ann', { event: 'miss' });
    }
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Bob Wins');
    expect(status.getAttribute('data-pong-status')).toBe('won');
  });

  it('leaves your paddle where it is when the table has no box yet', () => {
    seat([me(0), ann]);
    render(<PingPongGame element={table()} />);
    frames(50);
    act(() => receiveGameOp('ann', annInput()));
    const control = document.querySelector('[data-pong-control]')!;
    document.querySelector('[data-pong]')!.remove();
    fireEvent.pointerMove(control, { clientY: 30 });
    frames(100);
    expect(sent.filter((o) => o.kind === 'game-input')).toHaveLength(1);
  });
});

describe('scoreboardText and the pointer', () => {
  const players = [
    { id: 'me', name: 'You', color: '#000', self: true },
    { id: 'ann', name: 'Ann', color: '#000', self: false },
  ] as const;
  it('names the winner, you as You', () => {
    expect(scoreboardText({ status: 'won', score: [11, 3], winner: 0 }, players)).toBe('You Win');
    expect(scoreboardText({ status: 'won', score: [3, 11], winner: 1 }, players)).toBe('Ann Wins');
    expect(scoreboardText({ status: 'won', score: [3, 11], winner: null }, players)).toBe(
      'You Win',
    );
    expect(scoreboardText({ status: 'play', score: null, winner: null }, players)).toBe(
      'You 0, Ann 0',
    );
  });
  it('reads the pointer’s height over the table top', () => {
    // The drawing at its grid's own size: the table top runs from 30 to 74 down it.
    const box = { left: 0, top: 0, width: 184, height: 112 };
    const front = pongFrame('n');
    expect(framePointerAxis(front, { clientX: 0, clientY: 52 }, box)).toBeCloseTo(0.5);
    expect(framePointerAxis(front, { clientX: 0, clientY: 30 }, box)).toBeCloseTo(0);
    expect(framePointerAxis(front, { clientX: 0, clientY: 52 }, { ...box, height: 0 })).toBe(0.5);
  });
});

describe('PingPongGame at a turned table', () => {
  const turned = (chairFacing: 'e' | 's' | 'w'): ShapeElement => ({ ...table(), chairFacing });
  const paddle = (seat: 0 | 1) =>
    document.querySelector(`[data-pong-paddle="${seat}"]`)!.getAttribute('transform')!;
  const xy = (t: string) => t.match(/-?[\d.]+/g)!.map(Number) as [number, number];

  it('on its side: takes A/D and Left/Right for your paddle, which moves across the canvas, and leaves W/S and Up/Down to the walk', () => {
    seat([me(0), ann]);
    const view = render(<PingPongGame element={turned('e')} />);
    frames(50);
    act(() => receiveGameOp('ann', annInput()));
    expect(document.querySelector('[data-pong]')!.getAttribute('data-pong-across')).toBe('x');
    for (const key of ['a', 'D', 'ArrowLeft', 'ArrowRight'])
      expect(avatarKeyClaimed({ key }), key).toBe(true);
    for (const key of ['w', 's', 'ArrowUp', 'ArrowDown'])
      expect(avatarKeyClaimed({ key }), key).toBe(false);
    // Your paddle (the left seat's) is at the far end, the top; the other at the bottom.
    const [, y0] = xy(paddle(0));
    const [, y1] = xy(paddle(1));
    expect(y0).toBeLessThan(y1);
    const [x, y] = xy(paddle(0));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    frames(200);
    fireEvent.keyUp(window, { key: 'ArrowRight' });
    const [x2, y2] = xy(paddle(0));
    expect(x2).toBeGreaterThan(x);
    expect(y2).toBe(y);
    fireEvent.keyDown(window, { key: 'a' });
    frames(200);
    fireEvent.keyUp(window, { key: 'a' });
    expect(xy(paddle(0))[0]).toBeLessThan(x2);
    // W is not the paddle's here.
    const still = paddle(0);
    fireEvent.keyDown(window, { key: 'w' });
    frames(200);
    fireEvent.keyUp(window, { key: 'w' });
    expect(paddle(0)).toBe(still);
    view.unmount();
    expect(avatarKeyClaimed({ key: 'ArrowLeft' })).toBe(false);
  });

  it('on its side: the pointer’s position across the table moves your paddle, and the score sits beside it, top seat first', () => {
    seat([me(0), ann]);
    render(<PingPongGame element={turned('w')} />);
    frames(50);
    act(() => receiveGameOp('ann', annInput()));
    frames(PONG.servePauseMs + 100);
    const control = document.querySelector('[data-pong-control]')!;
    expect(control.className).toContain('cursor-ew-resize');
    const svg = document.querySelector('[data-pong]')!;
    svg.getBoundingClientRect = () => ({ top: 0, height: 184, left: 0, width: 112 }) as DOMRect;
    fireEvent.pointerDown(control, { clientX: 30, clientY: 10, pointerId: 1 });
    frames(20);
    const left = xy(paddle(0))[0];
    fireEvent.pointerMove(control, { clientX: 80, clientY: 10 });
    frames(20);
    expect(xy(paddle(0))[0]).toBeGreaterThan(left);
    const points = [...document.querySelectorAll('[data-pong-points]')].map((p) =>
      p.getAttribute('data-pong-points'),
    );
    expect(points).toEqual(['0', '1']);
    expect(screen.getByRole('status').className).toContain('flex-col');
  });

  it('from behind: plays as the front, W/S and Up/Down, the left seat at the right end and its points on the right', () => {
    seat([me(0), ann]);
    render(<PingPongGame element={turned('s')} />);
    frames(50);
    act(() => receiveGameOp('ann', annInput()));
    frames(PONG.servePauseMs + 100);
    expect(avatarKeyClaimed({ key: 'ArrowUp' })).toBe(true);
    expect(avatarKeyClaimed({ key: 'ArrowLeft' })).toBe(false);
    expect(xy(paddle(0))[0]).toBeGreaterThan(xy(paddle(1))[0]);
    const [x, y] = xy(paddle(0));
    fireEvent.keyDown(window, { key: 's' });
    frames(200);
    fireEvent.keyUp(window, { key: 's' });
    expect(xy(paddle(0))).toEqual([x, expect.any(Number)]);
    expect(xy(paddle(0))[1]).toBeGreaterThan(y);
    const points = [...document.querySelectorAll('[data-pong-points]')].map((p) =>
      p.getAttribute('data-pong-points'),
    );
    expect(points).toEqual(['1', '0']);
  });

  it('rallies down the turned table while it rests, across it facing down or up', () => {
    seat([me(0)]);
    const side = render(
      <svg>
        <SocialArt kind="ping-pong-table" id="table" sitters={2} facing="e" />
      </svg>,
    );
    expect(side.container.querySelector('[data-rally]')!.getAttribute('data-rally')).toBe('down');
    const back = render(
      <svg>
        <SocialArt kind="ping-pong-table" id="table" sitters={2} facing="s" />
      </svg>,
    );
    expect(back.container.querySelector('[data-rally]')!.getAttribute('data-rally')).toBe('across');
  });
});
