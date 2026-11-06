import { describe, expect, it } from 'vitest';
import { armRoomAlarm, disarmRoomAlarm, ROOM_ALARM_FLOOR_MS, roomAlarmAt } from './room-alarm';

const NOW = 1_800_000_000_000;

function storage() {
  const calls: (number | 'delete')[] = [];
  return {
    calls,
    setAlarm: async (at: number) => void calls.push(at),
    deleteAlarm: async () => void calls.push('delete'),
  };
}

describe('roomAlarmAt', () => {
  it('keeps a time far enough ahead', () => {
    expect(roomAlarmAt(NOW + 60_000, NOW)).toBe(NOW + 60_000);
    expect(roomAlarmAt(NOW + ROOM_ALARM_FLOOR_MS, NOW)).toBe(NOW + ROOM_ALARM_FLOOR_MS);
  });

  it('floors a time due now, soon or long past to a second from now', () => {
    for (const due of [NOW, NOW + 999, NOW - 1, 0]) {
      expect(roomAlarmAt(due, NOW)).toBe(NOW + ROOM_ALARM_FLOOR_MS);
    }
  });
});

describe('armRoomAlarm', () => {
  it('sets the earliest time due, floored, and answers it', () => {
    const s = storage();
    expect(armRoomAlarm(s, [NOW + 90_000, null, NOW + 30_000], NOW)).toBe(NOW + 30_000);
    expect(s.calls).toEqual([NOW + 30_000]);

    const past = storage();
    expect(armRoomAlarm(past, [NOW + 30_000, NOW - 5_000], NOW)).toBe(NOW + ROOM_ALARM_FLOOR_MS);
    expect(past.calls).toEqual([NOW + ROOM_ALARM_FLOOR_MS]);
  });

  it('deletes the alarm when nothing is due', () => {
    const s = storage();
    expect(armRoomAlarm(s, [null, null], NOW)).toBeNull();
    expect(armRoomAlarm(storage(), [], NOW)).toBeNull();
    expect(s.calls).toEqual(['delete']);
  });

  it('writes nothing for an alarm already set to that time, or already deleted', () => {
    const s = storage();
    armRoomAlarm(s, [NOW + 30_000], NOW);
    armRoomAlarm(s, [NOW + 30_000, NOW + 40_000], NOW + 5_000);
    armRoomAlarm(s, [null], NOW + 5_000);
    armRoomAlarm(s, [], NOW + 6_000);
    expect(s.calls).toEqual([NOW + 30_000, 'delete']);
  });

  it('sets it again when the time changes, and re-floors a stuck time once it has fired', () => {
    const s = storage();
    armRoomAlarm(s, [NOW + 20_000], NOW);
    armRoomAlarm(s, [NOW - 1], NOW);
    // The alarm fired a second later and the same stuck time is still due: the next goes a second on, not at once.
    armRoomAlarm(s, [NOW - 1], NOW + ROOM_ALARM_FLOOR_MS);
    expect(s.calls).toEqual([
      NOW + 20_000,
      NOW + ROOM_ALARM_FLOOR_MS,
      NOW + 2 * ROOM_ALARM_FLOOR_MS,
    ]);
  });

  it('keeps each storage apart: another object arms its own alarm', () => {
    const a = storage();
    const b = storage();
    armRoomAlarm(a, [NOW + 30_000], NOW);
    armRoomAlarm(b, [NOW + 30_000], NOW);
    expect(a.calls).toEqual([NOW + 30_000]);
    expect(b.calls).toEqual([NOW + 30_000]);
  });
});

describe('disarmRoomAlarm', () => {
  it('deletes the alarm, and arming after it sets the same time again', async () => {
    const s = storage();
    armRoomAlarm(s, [NOW + 30_000], NOW);
    await disarmRoomAlarm(s);
    // A purge deleted the alarm the room remembered: the same time, still ahead, is set again rather than skipped.
    expect(armRoomAlarm(s, [NOW + 30_000], NOW + 5_000)).toBe(NOW + 30_000);
    expect(s.calls).toEqual([NOW + 30_000, 'delete', NOW + 30_000]);
  });

  it('deletes even an alarm never armed in memory, and a later "nothing due" deletes again', async () => {
    const s = storage();
    await disarmRoomAlarm(s);
    armRoomAlarm(s, [], NOW);
    expect(s.calls).toEqual(['delete', 'delete']);
  });
});
