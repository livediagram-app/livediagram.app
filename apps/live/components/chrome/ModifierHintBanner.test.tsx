// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DragState } from '@/lib/canvas';
import { setInsertionDragInHand } from '@/lib/insertion-preview';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { ModifierHintBanner } from './ModifierHintBanner';

function holdShift(down: boolean) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: 'Shift' }));
  });
}

function show(props: Partial<Parameters<typeof ModifierHintBanner>[0]> = {}) {
  return render(
    <ModifierHintBanner
      drag={null}
      selectedKind={null}
      hasElements
      suppressed={false}
      esBoard={false}
      {...props}
    />,
  );
}

const MOVE_DRAG = { kind: 'boxed', mode: 'move' } as DragState;

afterEach(() => {
  // `globals: false` means no automatic RTL cleanup; without this every
  // render stacks up and the queries match the previous test's banner.
  cleanup();
  holdShift(false);
  act(() => {
    setInsertionDragInHand(false);
    setPaletteDragPreview(null);
  });
});

describe('ModifierHintBanner', () => {
  it('says nothing when no modifier is worth naming', () => {
    show();
    expect(screen.queryByText(/shift|alt/i)).toBeNull();
  });

  it('names what Shift is doing while it is held', () => {
    show();
    holdShift(true);
    expect(screen.getByText(/click elements to select several/i)).toBeTruthy();
  });

  // Q4: a held modifier nobody knows about is a feature nobody finds. The
  // offer appears DURING the drag, before Alt is touched — which is also the
  // only wording that works where a window manager claims Alt+press.
  describe('the insert-between offer (spec/139)', () => {
    it('offers the gesture while a note already on the board is dragged', () => {
      show();
      act(() => setInsertionDragInHand(true));
      expect(screen.getByText(/insert it between two notes/i)).toBeTruthy();
      expect(screen.getByText('Alt')).toBeTruthy();
    });

    it('offers it while a sticky is dragged in from the palette', () => {
      show({ esBoard: true });
      act(() => setPaletteDragPreview({ kind: 'square', width: 200, height: 200, note: true }));
      expect(screen.getByText(/insert it between two notes/i)).toBeTruthy();
    });

    it('stays quiet for a palette drag on any other board', () => {
      show({ esBoard: false });
      act(() => setPaletteDragPreview({ kind: 'square', width: 200, height: 200, note: true }));
      expect(screen.queryByText(/insert it between/i)).toBeNull();
    });

    it('stays quiet for a palette drag of something that will not be a note', () => {
      show({ esBoard: true });
      act(() => setPaletteDragPreview({ kind: 'square', width: 200, height: 200 }));
      expect(screen.queryByText(/insert it between/i)).toBeNull();
    });

    it('yields to the drag-duplicate Shift already owns', () => {
      show({ drag: MOVE_DRAG });
      act(() => setInsertionDragInHand(true));
      holdShift(true);
      expect(screen.queryByText(/insert it between/i)).toBeNull();
    });

    it('is suppressed with every other hint while a mode banner owns the slot', () => {
      show({ suppressed: true });
      act(() => setInsertionDragInHand(true));
      expect(screen.queryByText(/insert it between/i)).toBeNull();
    });
  });
});
