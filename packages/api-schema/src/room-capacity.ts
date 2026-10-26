// How many connections one realtime room holds, for every product's room (livediagram's
// docs/specs/015-api/api.md "A room holds at most 100 connections"). Every op a room relays is sent
// to each of its sockets, so the cap bounds one Durable Object's fan-out and its memory: at 100, a
// busy session's op costs at most 100 sends.
export const ROOM_MAX_CONNECTIONS = 100;

// The WebSocket close code a room ends an over-capacity upgrade with, in the 4000-4999 application
// range beside each product's 4003-4007. The connection is answered and closed at once, never
// admitted, so it holds no presence and receives nothing.
export const ROOM_FULL_CLOSE = 4008;

// The close reason that goes with it, and the words an editor shows.
export const ROOM_FULL_REASON = 'room-full';
export const ROOM_FULL_MESSAGE = 'This room is full';

// How long an editor turned away waits before it tries to join again. It also tries whenever its tab
// is shown again.
export const ROOM_FULL_RETRY_MS = 60_000;

// Whether a room already holding `connections` sockets must turn the next one away.
export function roomIsFull(connections: number): boolean {
  return connections >= ROOM_MAX_CONNECTIONS;
}
