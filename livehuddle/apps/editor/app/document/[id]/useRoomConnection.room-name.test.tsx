// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoomHandlers } from '@/lib/api-client';
import { createRoomNameSync } from './room-name-sync';

// Our own name follows the room's (docs/specs/014-identity/auth-and-guest-access.md "Presence names"; Work Tracker
// 797): the room picks every name, so our own avatar shows what peers see, except while a name we chose is on its way.

const { room } = vi.hoisted(() => ({ room: { handlers: null as RoomHandlers | null } }));
vi.mock('@/lib/api-client', () => ({
  apiCreateRoomTicket: vi.fn(async () => null),
  connectRoom: vi.fn((_doc: string, _self: unknown, handlers: RoomHandlers) => {
    room.handlers = handlers;
    return { send: vi.fn(), close: vi.fn() };
  }),
}));

const { useRoomConnection } = await import('./useRoomConnection');

async function mount(localName: string) {
  const self = { id: 'guest_1', name: localName, color: '#0ea5e9', status: 'online' as const };
  const sync = createRoomNameSync();
  const adoptRoomName = vi.fn();
  renderHook(() =>
    useRoomConnection({
      hydrated: true,
      documentId: 'doc-1',
      documentServerStored: true,
      enabled: true,
      documentTeamId: null,
      selfParticipant: self,
      sessionShareCode: null,
      lastSeenRef: { current: new Map() },
      selfParticipantRef: { current: self },
      saveBaseline: {
        tabs: { current: [] },
        name: { current: '' },
        journal: { current: { entries: [] } as never },
      },
      sessionShareCodeRef: { current: null },
      roomRef: { current: null },
      markSeen: vi.fn(),
      loadedTabIdsRef: { current: new Set<string>() },
      roomNameSync: sync,
      adoptRoomName,
      setSelfParticipant: vi.fn(),
      setLiveAgents: vi.fn(),
      setLivePresence: vi.fn(),
      setRemoteTabFocus: vi.fn(),
      setRemoteSelections: vi.fn(),
      setRemoteCursors: vi.fn(),
      setRemoteViewports: vi.fn(),
      setRemoteAvatars: vi.fn(),
      onRoomJoined: vi.fn(),
    } as unknown as Parameters<typeof useRoomConnection>[0]),
  );
  await waitFor(() => expect(room.handlers).not.toBeNull());
  return { sync, adoptRoomName };
}

const roster = (...people: { key: string; name: string }[]) =>
  people.map((p, i) => ({ id: `p${i}`, color: '#000', ...p }));

describe('useRoomConnection and our presence name', () => {
  it("takes the room's name for us, found by the collab key the room gave this session", async () => {
    const { adoptRoomName } = await mount('Random Fox');
    room.handlers!.onCollabKey!('k-me');
    room.handlers!.onPresence(
      roster({ key: 'k-peer', name: 'Bo' }, { key: 'k-me', name: 'Quiet Otter' }),
      [],
    );
    expect(adoptRoomName).toHaveBeenCalledWith('Quiet Otter');
  });

  it('keeps a name just chosen while the roster still shows the old one', async () => {
    const { sync, adoptRoomName } = await mount('Grace');
    sync.chose('Grace');
    room.handlers!.onCollabKey!('k-me');
    room.handlers!.onPresence(roster({ key: 'k-me', name: 'Random Fox' }), []);
    expect(adoptRoomName).not.toHaveBeenCalled();
  });

  it('does nothing before the room names our key, or when we are not on the roster', async () => {
    const { adoptRoomName } = await mount('Me');
    room.handlers!.onPresence(roster({ key: 'k-me', name: 'Other' }), []);
    room.handlers!.onCollabKey!('k-me');
    room.handlers!.onPresence(roster({ key: 'k-peer', name: 'Bo' }), []);
    expect(adoptRoomName).not.toHaveBeenCalled();
  });
});
