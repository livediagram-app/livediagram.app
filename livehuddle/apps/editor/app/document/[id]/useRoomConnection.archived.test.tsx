// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomHandlers } from '@/lib/api-client';

// Archived from elsewhere while open (liveworkspace/docs/specs/004-index/one-explorer.md "Archived from elsewhere
// while open"; Work Tracker 1242): the room's 4010 reaches the editor's handler, which leaves for the Explorer.
// Nothing reloads in its place.

const { room } = vi.hoisted(() => ({ room: { handlers: null as RoomHandlers | null } }));
vi.mock('@/lib/api-client', () => ({
  apiCreateRoomTicket: vi.fn(async () => null),
  connectRoom: vi.fn((_doc: string, _self: unknown, handlers: RoomHandlers) => {
    room.handlers = handlers;
    return { send: vi.fn(), close: vi.fn() };
  }),
}));

const { useRoomConnection } = await import('./useRoomConnection');

const reload = vi.fn();
const realLocation = window.location;

function mount(onItemArchived?: () => void) {
  const self = { id: 'guest_1', name: 'Grace', color: '#0ea5e9', status: 'online' as const };
  return renderHook(() =>
    useRoomConnection({
      hydrated: true,
      documentId: 'doc-1',
      documentServerStored: true,
      enabled: true,
      onItemArchived,
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
      adoptRoomName: vi.fn(),
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
}

afterEach(() => {
  room.handlers = null;
  reload.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

describe('useRoomConnection when the item is archived elsewhere', () => {
  it("hands the room's archive to the editor once, and never reloads", async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, reload },
    });
    const onItemArchived = vi.fn();
    mount(onItemArchived);
    await waitFor(() => expect(room.handlers).not.toBeNull());
    room.handlers!.onItemArchived!();
    expect(onItemArchived).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing when the editor passes no handler', async () => {
    mount();
    await waitFor(() => expect(room.handlers).not.toBeNull());
    expect(() => room.handlers!.onItemArchived!()).not.toThrow();
  });
});
