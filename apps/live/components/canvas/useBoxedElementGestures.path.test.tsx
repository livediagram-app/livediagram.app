// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPath } from '@livediagram/document';
import { useBoxedElementGestures } from './useBoxedElementGestures';

// docs/specs/023-whiteboard/path-tool.md "Editing": a double-tap (two presses the ledger pairs) opens
// a path's edit mode, since a touch screen's own dblclick is unreliable.
describe('a double press on a path', () => {
  it('opens its edit mode', () => {
    const path = createPath(
      [
        { x: 0, y: 0, mode: 'corner' },
        { x: 50, y: 0, mode: 'corner' },
      ],
      false,
    );
    const onBeginEdit = vi.fn();
    const onBeginDrag = vi.fn();
    const { result } = renderHook(() =>
      useBoxedElementGestures({
        element: path,
        wrapperRef: { current: null },
        isEditing: false,
        remotelyLocked: false,
        isAnnotation: false,
        isMultiSelected: false,
        isSelected: true,
        onBeginDrag,
        onBeginEdit,
      } as never),
    );
    const press = (t: number) =>
      result.current.handleShapeDown({
        button: 0,
        timeStamp: t,
        clientX: 10,
        clientY: 10,
        pointerType: 'touch',
        stopPropagation: () => {},
      } as unknown as ReactPointerEvent);
    press(10_000);
    press(10_200);
    expect(onBeginEdit).toHaveBeenCalledWith(path.id);
  });
});
