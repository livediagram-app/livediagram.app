'use client';

// A Ping-Pong Table's game on this screen (docs/specs/009-elements/social-pieces.md "A game", "Controls", "Reduced
// motion"): the table's session (lib/table-games/pong-session.ts) fed by the seats, the room and your controls, and
// stepped by one requestAnimationFrame loop that also moves the ball and both paddles through the refs it is handed,
// so a frame costs one tick and three attribute writes and never a React render. React hears only of the
// scoreboard, when it changes (a store over the session's onView). Under reduced motion the loop is a slow timer and nothing moves.
//
// Nothing runs at a table with an empty seat: no loop, no keys, no listener beyond the room's inbox.

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { claimAvatarKeys, type ClaimedKey } from '@liveworkspace/avatar/key-claims';
import { walkInputBlocked } from '@liveworkspace/avatar/walk-guard';
import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import { PREFERS_REDUCED_MOTION, prefersReducedMotion, useMediaQuery } from '@livehuddle/ui';
import { onGameOp } from '@/lib/table-games/table-game-inbox';
import { PongSession } from '@/lib/table-games/pong-session';
import {
  sendGameOp,
  setGameOn,
  tableGameScene,
  useGameSeats,
} from '@/lib/table-games/table-game-scene';
import { track } from '@/lib/telemetry';

/** Under reduced motion the game still keeps time (a point, the silent rule), a few times a second. */
const REDUCED_TICK_MS = 250;

/** The longest step one frame may take: a tab back from the background does not leap the paddles. */
const MAX_FRAME_MS = 100;

const UP_KEYS = new Set(['w', 'W', 'ArrowUp']);
const DOWN_KEYS = new Set(['s', 'S', 'ArrowDown']);
const isPaddleKey = (e: ClaimedKey) =>
  !e.metaKey && !e.ctrlKey && !e.altKey && (UP_KEYS.has(e.key) || DOWN_KEYS.has(e.key));

/** Where the drawing puts the ball and paddles each frame: the play area's 0 to 1, onto the art's grid. */
export type PongDraw = (session: PongSession, now: number) => void;

const newMatchId = (): string => crypto.randomUUID().slice(0, 12);

export function usePingPong(pieceId: string, draw: PongDraw) {
  const seats = useGameSeats(pieceId, 2);
  const reduced = useMediaQuery(PREFERS_REDUCED_MOTION) || prefersReducedMotion();
  // The session and the scoreboard's store: React hears of the scoreboard only when it changes, never per frame.
  const [{ session, changed }] = useState(() => {
    const changed = createListeners();
    const session = new PongSession({
      pieceId,
      send: (op) => sendGameOp(op),
      newMatchId,
      random: Math.random,
      onWon: () => track('Canvas', 'Used', 'PingPong'),
      onView: changed.notify,
    });
    return { session, changed };
  });
  const view = useSyncExternalStore(
    changed.subscribe,
    () => session.shownView,
    () => session.shownView,
  );
  const drawRef = useLatest(draw);

  const bothHeld = !!seats[0] && !!seats[1];
  useEffect(() => {
    session.setSeats(seats, !reduced);
  }, [session, seats, reduced]);

  // A peer's paddle or moment, for this table on this tab.
  useEffect(
    () =>
      onGameOp((from, op) => {
        if (op.pieceId !== pieceId || op.tabId !== tableGameScene().tabId) return;
        session.receive(from, op, performance.now());
      }),
    [session, pieceId],
  );

  // The resting rally gives way while a game is on.
  const on = view.status === 'ready' || view.status === 'play' || view.status === 'won';
  useEffect(() => {
    setGameOn(pieceId, on);
    return () => setGameOn(pieceId, false);
  }, [pieceId, on]);

  // The keys, while you play here and a game is on: W/S and Up/Down hold the paddle and leave the walk alone.
  const held = useRef({ up: false, down: false });
  const mine = seats.findIndex((p) => p?.self) >= 0;
  const keysOn = mine && on && !reduced;
  useEffect(() => {
    if (!keysOn) return;
    const release = claimAvatarKeys(isPaddleKey);
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (!isPaddleKey(e)) return;
      if (down && (isTypingTarget(e.target) || walkInputBlocked())) return;
      if (down) e.preventDefault();
      if (UP_KEYS.has(e.key)) held.current.up = down;
      else held.current.down = down;
    };
    const keyDown = onKey(true);
    const keyUp = onKey(false);
    const blur = () => {
      held.current = { up: false, down: false };
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      release();
      blur();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    };
  }, [keysOn]);

  // The loop: only with both seats held. Every frame steps the game and draws it; React hears only of the scoreboard.
  useEffect(() => {
    if (!bothHeld) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - last));
      last = now;
      const keys = held.current;
      if (keys.up !== keys.down) session.nudge(keys.up ? -1 : 1, dt);
      session.tick(now, dt);
    };
    if (reduced) {
      const timer = setInterval(() => step(performance.now()), REDUCED_TICK_MS);
      return () => clearInterval(timer);
    }
    let raf = 0;
    const frame = (now: number) => {
      step(now);
      drawRef.current(session, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [bothHeld, reduced, session, drawRef]);

  return { view, seats, reduced, session, mine };
}

/** The paddle under a pointer: its height over the table top's box, 0 at the top and 1 at the bottom. */
export function pointerAxis(
  e: Pick<ReactPointerEvent, 'clientY'>,
  table: { top: number; height: number },
): number {
  return table.height > 0 ? (e.clientY - table.top) / table.height : 0.5;
}
