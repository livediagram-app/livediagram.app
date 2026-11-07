// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sendGameOp, tableGameScene } from './table-game-scene';
import { useTableGameScene } from './useTableGameScene';

// docs/specs/009-elements/social-pieces.md "A game": the canvas publishes who sits where, and the room, to the scene.

const props = (send?: (op: unknown) => void) => ({
  tabId: 't',
  selfId: 'me',
  selfColor: '#111',
  seatedOn: 'table',
  seatClaim: { index: 1, at: 0, tie: 0 },
  takePart: true,
  peers: [],
  seatsOf: () => null,
  send,
});

describe('useTableGameScene', () => {
  it('publishes you on your seat, sends through the newest sender, and clears the scene when it goes', () => {
    const first = vi.fn();
    const { rerender, unmount } = renderHook((p) => useTableGameScene(p), {
      initialProps: props(first),
    });
    expect(tableGameScene().sources[0]).toMatchObject({ id: 'me', seat: 1, plays: true });
    const second = vi.fn();
    rerender(props(second));
    const op = { kind: 'game-input', pieceId: 'table', seat: 1, axis: 0.5 } as const;
    expect(sendGameOp(op)).toBe(true);
    expect(second).toHaveBeenCalledWith(op);
    expect(first).not.toHaveBeenCalled();
    // No room: nothing to send through.
    rerender(props(undefined));
    expect(sendGameOp(op)).toBe(false);
    unmount();
    expect(tableGameScene().selfId).toBe('');
  });

  it('seats nobody when you sit nowhere', () => {
    renderHook(() => useTableGameScene({ ...props(), seatedOn: null }));
    expect(tableGameScene().sources[0]).toMatchObject({ seatedOn: null, seat: null });
  });
});
