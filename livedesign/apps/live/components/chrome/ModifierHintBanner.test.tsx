// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DragState } from '@/lib/canvas';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { ModifierHint } from './ModifierHintBanner';

// The banner itself is workbench's (its ModifierHintBanner.test.tsx); this is livedesign's binding of it, which reads
// the drag from the drag store (docs/specs/008-canvas/blueprints/canvas-performance.md "The drag state lives in a
// store").

function holdShift(down: boolean) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: 'Shift' }));
  });
}

afterEach(() => {
  cleanup();
  holdShift(false);
});

describe('ModifierHint', () => {
  it('follows the drag store: the aspect lock while resizing, nothing while moving', () => {
    const dragStore = createStateStore<DragState | null>(null);
    render(
      <SelectionStoreProvider store={createSelectionStore()}>
        <ModifierHint elements={[]} dragStore={dragStore} hasElements suppressed={false} />
      </SelectionStoreProvider>,
    );
    holdShift(true);
    expect(screen.getByText(/click elements to select several/i)).toBeTruthy();
    act(() => dragStore.set({ kind: 'boxed', mode: 'resize-se' } as DragState));
    expect(screen.getByText(/proportions locked/i)).toBeTruthy();
    act(() => dragStore.set({ kind: 'boxed', mode: 'move' } as DragState));
    expect(screen.queryByText(/proportions locked|select several/i)).toBeNull();
  });
});
