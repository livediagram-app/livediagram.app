import { describe, expect, it, vi } from 'vitest';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu.types';
import { useCanvasMenuProps } from './useCanvasMenuProps';

// The selection menu's state records the member right-clicked (docs/specs/009-elements/office.md "A piece's type"):
// its kind picks the Type section the menu offers.

const setContextMenu = vi.fn();
let isReadOnly = false;
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ({
    facilitator: null,
    isReadOnly,
    lockedByOther: () => false,
    remoteSelectionsByElement: new Map(),
    setContextMenu,
  }),
}));

describe('the selection menu’s state', () => {
  it('opens at the cursor naming the member right-clicked', () => {
    setContextMenu.mockClear();
    useCanvasMenuProps(vi.fn()).onMultiContextMenu!(40, 50, 'rug-b');
    expect(setContextMenu).toHaveBeenCalledExactlyOnceWith({
      mode: 'multi',
      x: 40,
      y: 50,
      elementId: 'rug-b',
    } satisfies EditorContextMenuState);
  });

  it('names no member when none was given', () => {
    setContextMenu.mockClear();
    useCanvasMenuProps(vi.fn()).onMultiContextMenu!(40, 50);
    expect(setContextMenu).toHaveBeenCalledExactlyOnceWith({ mode: 'multi', x: 40, y: 50 });
  });

  it('opens no selection menu for a Viewer', () => {
    isReadOnly = true;
    expect(useCanvasMenuProps(vi.fn()).onMultiContextMenu).toBeUndefined();
    isReadOnly = false;
  });
});
