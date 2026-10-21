// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomHandlers } from '@/lib/api-client';

// The room under a workbench session (docs/specs/013-workspace/blueprints/workbench-embeds.md "The
// workbench page" step 6, WB31): its end (close 4006) and an access change (4005) end the session
// instead of reloading a frame that cannot reload into another access path; outside a workbench an
// access change still reloads.

const { room } = vi.hoisted(() => ({
  room: { handlers: null as RoomHandlers | null, close: vi.fn() },
}));
vi.mock('@/lib/api-client', () => ({
  apiCreateRoomTicket: vi.fn(async () => ({ ticket: 'ticket' })),
  connectRoom: vi.fn((_doc: string, _self: unknown, handlers: RoomHandlers) => {
    room.handlers = handlers;
    return { send: vi.fn(), close: room.close, updateSelf: vi.fn() };
  }),
}));

const { useRoomConnection } = await import('./useRoomConnection');

function mount(onWorkbenchEnded?: () => void) {
  const fn = new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (t, k: string) => (t[k] ??= vi.fn()),
  });
  return renderHook(() =>
    useRoomConnection({
      ...(fn as unknown as Parameters<typeof useRoomConnection>[0]),
      hydrated: true,
      documentId: 'doc-1',
      documentServerStored: true,
      enabled: true,
      onWorkbenchEnded,
      documentTeamId: null,
      selfParticipant: { id: 'user_1', name: 'Webber', color: '#0ea5e9', status: 'online' },
      sessionShareCode: null,
      lastSeenRef: { current: new Map() },
      selfParticipantRef: {
        current: { id: 'user_1', name: 'Webber', color: '#0ea5e9', status: 'online' },
      },
      saveBaseline: {
        tabs: { current: [] },
        name: { current: '' },
        journal: { current: { entries: [] } as never },
      },
      sessionShareCodeRef: { current: null },
      roomRef: { current: null },
    }),
  );
}

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  room.handlers = null;
  reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useRoomConnection under a workbench session', () => {
  it('ends the session when the room ends it', async () => {
    const ended = vi.fn();
    mount(ended);
    await waitFor(() => expect(room.handlers).not.toBeNull());

    room.handlers!.onWorkbenchEnded!();

    expect(ended).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reads an access change as the session ending, never reloading', async () => {
    const ended = vi.fn();
    mount(ended);
    await waitFor(() => expect(room.handlers).not.toBeNull());

    room.handlers!.onAccessChanged!();

    expect(ended).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('still reloads on an access change outside a workbench, and ignores a workbench end', async () => {
    mount();
    await waitFor(() => expect(room.handlers).not.toBeNull());

    room.handlers!.onWorkbenchEnded!();
    room.handlers!.onAccessChanged!();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
