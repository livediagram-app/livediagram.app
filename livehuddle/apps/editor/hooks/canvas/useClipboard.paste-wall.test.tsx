// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, mountsOnWall, snapToWallFace, type Element } from '@livehuddle/document';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

afterEach(() => {
  cleanup();
});

function paste(source: Element[], tab: Element[]): Element[] {
  let landed: Element[] = tab;
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Other tab', elements: tab },
      commit: (map: (els: Element[]) => Element[]) => {
        landed = map(tab);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      toast: { error: vi.fn(), info: vi.fn() } as never,
      ownerId: 'owner',
      documentId: null,
    }),
  );
  act(() => result.current.pasteFromClipboard(source));
  return landed;
}

// docs/specs/009-elements/wall-pieces.md "Only on a wall": a pasted wall piece goes onto the nearest wall.
const room = { ...createShape('room', 0, 0), id: 'room', width: 600, height: 400 } as Element;
const sign = { ...createShape('room-sign', 260, 200), id: 'sign' } as Element;

describe('pasting a wall piece', () => {
  it('puts one pasted onto the floor onto a wall', () => {
    const out = paste([sign], [room]);
    const pasted = out.find((el) => el.type === 'shape' && mountsOnWall(el.shape))!;
    expect(pasted).toBeDefined();
    expect(pasted.id).not.toBe('sign');
    // Off a wall where it was copied; on one, so the snap leaves it, where it landed.
    expect(snapToWallFace(sign as never, [room])).not.toEqual(sign);
    expect(snapToWallFace(pasted as never, [room])).toEqual(pasted);
  });
  it('leaves one pasted with no wall on the tab where it lands', () => {
    const out = paste([sign], []);
    expect(out).toHaveLength(1);
  });
});
