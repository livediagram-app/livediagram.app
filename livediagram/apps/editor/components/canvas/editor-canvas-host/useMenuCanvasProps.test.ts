// @vitest-environment jsdom
// The element menu opened from a Behaviours face's `…` (docs/specs/008-canvas/canvas-and-palette.md): the `…` stops
// its press, so the element may not be selected when its Settings row opens the menu. Every row acts on the
// selection, so the menu must select the element first, as a right-click does.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ctx = vi.hoisted(() => ({
  isReadOnly: false,
  lockedByOther: vi.fn((_id: string) => false),
  selectElement: vi.fn(),
  setContextMenu: vi.fn(),
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));

import { useMenuCanvasProps } from './useMenuCanvasProps';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const openSettings = () =>
  renderHook(() => useMenuCanvasProps({ setLockedMenu: () => {} })).result.current
    .onOpenElementSettings!;

describe('useMenuCanvasProps onOpenElementSettings', () => {
  it('selects the element before opening its menu', () => {
    document.body.innerHTML = '<div data-element-id="t1"></div>';
    openSettings()('t1');
    expect(ctx.selectElement).toHaveBeenCalledWith('t1');
    expect(ctx.setContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'element', elementId: 't1' }),
    );
    expect(ctx.selectElement.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.setContextMenu.mock.invocationCallOrder[0]!,
    );
  });

  it('opens nothing on an element a peer holds', () => {
    document.body.innerHTML = '<div data-element-id="t1"></div>';
    ctx.lockedByOther.mockReturnValueOnce(true);
    openSettings()('t1');
    expect(ctx.selectElement).not.toHaveBeenCalled();
    expect(ctx.setContextMenu).not.toHaveBeenCalled();
  });
});
