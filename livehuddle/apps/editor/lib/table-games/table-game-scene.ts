'use client';

// The tab as every game piece reads it (docs/specs/009-elements/social-pieces.md "A game", "The wire"): who you are,
// who sits where and may play, and the way to the room. The canvas publishes it (useTableGameScene) whenever presence
// changes; each game piece reads its own seats from it, kept by value, so a peer walking past re-renders no table.
// Held outside React, like the reception bell's store: a piece's session reads it at event time.

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { GameEventOp, GameInputOp } from '@livehuddle/api-schema';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { gameSeats, sameGameSeats, type GameSeatSource, type GameSeats } from './game-seats';

/** A game op as a piece sends it: the editor stamps the tab. */
export type GameSignal = Omit<GameInputOp, 'tabId'> | Omit<GameEventOp, 'tabId'>;

export type TableGameScene = {
  tabId: string;
  selfId: string;
  /** This screen's own person first, then every peer on the tab. */
  sources: readonly GameSeatSource[];
  /** The room, or null with none (a Space kept in This Browser, or not yet connected). */
  send: ((op: GameSignal) => void) | null;
};

const EMPTY: TableGameScene = { tabId: '', selfId: '', sources: [], send: null };

let scene: TableGameScene = EMPTY;
const listeners = createListeners();

/** Publish the tab's scene (the canvas), or the empty one when it goes. */
export function setTableGameScene(next: TableGameScene | null): void {
  scene = next ?? EMPTY;
  listeners.notify();
}

/** The scene now, read at event time. */
export function tableGameScene(): TableGameScene {
  return scene;
}

/** Send a game op to the room; false with no room to send it to. */
export function sendGameOp(op: GameSignal): boolean {
  if (!scene.send) return false;
  scene.send(op);
  return true;
}

/** The players at a piece's `seats` seats, changing only when one of them does. */
export function useGameSeats(pieceId: string, seats: number): GameSeats {
  const last = useRef<GameSeats | null>(null);
  const read = useCallback(() => {
    const next = gameSeats(pieceId, seats, scene.selfId, scene.sources);
    if (last.current && sameGameSeats(last.current, next)) return last.current;
    last.current = next;
    return next;
  }, [pieceId, seats]);
  return useSyncExternalStore(listeners.subscribe, read, read);
}

// --- Which pieces show a game ---------------------------------------------------------------------------------------

// A piece showing a game draws it in place of its resting loop (the Ping-Pong Table's decorative rally). Each piece's
// session says when its game comes and goes; the loop reads only its own piece's answer.
const gamesOn = new Set<string>();
const gameOnListeners = createListeners();

/** Say whether `pieceId` shows a game now. */
export function setGameOn(pieceId: string, on: boolean): void {
  if (gamesOn.has(pieceId) === on) return;
  if (on) gamesOn.add(pieceId);
  else gamesOn.delete(pieceId);
  gameOnListeners.notify();
}

/** Whether `pieceId` shows a game, changing only when its own answer does. */
export function useGameOn(pieceId: string): boolean {
  return useSyncExternalStore(
    gameOnListeners.subscribe,
    () => gamesOn.has(pieceId),
    () => false,
  );
}
