import { describe, expect, it, vi } from 'vitest';
import { announceRoomName, createRoomNameSync, ROOM_NAME_PENDING_MS } from './room-name-sync';

// docs/specs/014-identity/auth-and-guest-access.md "Presence names" (Work Tracker 797 and 801).

describe('createRoomNameSync', () => {
  it("takes the room's name as ours when nothing is pending", () => {
    const sync = createRoomNameSync();
    expect(sync.fromRoster('Quiet Otter', 'Random Fox', 0)).toBe('Quiet Otter');
    expect(sync.fromRoster('Same', 'Same', 0)).toBeNull();
    expect(sync.fromRoster('', 'Ours', 0)).toBeNull();
  });

  it('keeps a name we just chose until the room shows it', () => {
    const sync = createRoomNameSync();
    sync.chose('  Grace ', 0);
    // A roster from before the rename still carries the old name: not taken back.
    expect(sync.fromRoster('Random Fox', 'Grace', 10)).toBeNull();
    // The room shows it: settled, and from now on the room's name wins again.
    expect(sync.fromRoster('Grace', 'Grace', 20)).toBeNull();
    expect(sync.fromRoster('Renamed Elsewhere', 'Grace', 30)).toBe('Renamed Elsewhere');
  });

  it("gives the room's name back once a lost rename has waited long enough", () => {
    const sync = createRoomNameSync();
    sync.chose('Grace', 0);
    expect(sync.fromRoster('Random Fox', 'Grace', ROOM_NAME_PENDING_MS - 1)).toBeNull();
    expect(sync.fromRoster('Random Fox', 'Grace', ROOM_NAME_PENDING_MS)).toBe('Random Fox');
  });
});

describe('announceRoomName', () => {
  const base = () => {
    const sync = createRoomNameSync();
    const room = { send: vi.fn() };
    const announce = vi.fn(async () => 'Grace');
    return { sync, room, announce };
  };

  it('asks the api for a person whose profile write landed, never over the socket', async () => {
    const { sync, room, announce } = base();
    await announceRoomName({ sync, name: 'Grace', hasIdentity: true, saved: true, room, announce });
    expect(announce).toHaveBeenCalledOnce();
    expect(room.send).not.toHaveBeenCalled();
    expect(sync.fromRoster('Old', 'Grace', Date.now())).toBeNull();
  });

  it("asks nothing for a person whose write failed: the room keeps their profile's name", async () => {
    const { sync, room, announce } = base();
    await announceRoomName({
      sync,
      name: 'Grace',
      hasIdentity: true,
      saved: false,
      room,
      announce,
    });
    expect(announce).not.toHaveBeenCalled();
    expect(sync.fromRoster('Old', 'Grace')).toBe('Old');
  });

  it('names a link visitor over the socket, saved or not', async () => {
    const { sync, room, announce } = base();
    await announceRoomName({
      sync,
      name: 'Grace',
      hasIdentity: false,
      saved: false,
      room,
      announce,
    });
    expect(room.send).toHaveBeenCalledWith({ kind: 'visitor-name', name: 'Grace' });
    expect(announce).not.toHaveBeenCalled();
  });

  it('tells nobody with no room open', async () => {
    const { sync, announce } = base();
    await announceRoomName({
      sync,
      name: 'Grace',
      hasIdentity: true,
      saved: true,
      room: null,
      announce,
    });
    expect(announce).not.toHaveBeenCalled();
  });
});
