import { describe, expect, it } from 'vitest';
import {
  ROOM_FULL_CLOSE,
  ROOM_MAX_CONNECTIONS,
  ROOM_MAX_VIEW_ONLY,
  roomIsFull,
  viewOnlyRoomIsFull,
} from './room-capacity';

describe('room capacity', () => {
  it('admits the 100th connection and turns the 101st away', () => {
    expect(ROOM_MAX_CONNECTIONS).toBe(100);
    expect(roomIsFull(99)).toBe(false);
    expect(roomIsFull(100)).toBe(true);
  });

  it('holds its view-only sockets to a cap of their own', () => {
    expect(ROOM_MAX_VIEW_ONLY).toBe(50);
    expect(viewOnlyRoomIsFull(49)).toBe(false);
    expect(viewOnlyRoomIsFull(50)).toBe(true);
  });

  it('closes in the application range, clear of the codes the rooms already use', () => {
    expect(ROOM_FULL_CLOSE).toBeGreaterThanOrEqual(4000);
    expect(ROOM_FULL_CLOSE).toBeLessThan(5000);
    expect([4003, 4004, 4005, 4006, 4007]).not.toContain(ROOM_FULL_CLOSE);
  });
});
