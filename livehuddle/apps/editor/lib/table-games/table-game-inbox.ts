// A game at a piece arriving from the room (docs/specs/009-elements/social-pieces.md "The wire"): the room connection
// hands every `game-input` and `game-event` here, parsed, and the table that is showing a game listens. Nothing is
// written to the document. Whether the sender sits on the seat it names is the listener's to check: only it knows who
// sits where.

import {
  parseGameEvent,
  parseGameInput,
  type GameEventOp,
  type GameInputOp,
} from '@livehuddle/api-schema';

type GameListener = (from: string, op: GameInputOp | GameEventOp) => void;

const listeners = new Set<GameListener>();

/** A peer's game op off the room: parsed, then handed to every listener; a malformed one reaches none. */
export function receiveGameOp(from: string, raw: unknown): void {
  const op = parseGameInput(raw) ?? parseGameEvent(raw);
  if (!op) return;
  for (const listener of listeners) listener(from, op);
}

/** Listen for peers' game ops; returns the way to stop. */
export function onGameOp(listener: GameListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
