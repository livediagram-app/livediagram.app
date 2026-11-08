// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DragState } from '@/lib/canvas';
import { ModifierHintBanner } from './ModifierHintBanner';

function holdShift(down: boolean) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: 'Shift' }));
  });
}

function show(props: Partial<Parameters<typeof ModifierHintBanner>[0]> = {}) {
  return render(<ModifierHintBanner drag={null} hasElements suppressed={false} {...props} />);
}

afterEach(() => {
  // `globals: false` means no automatic RTL cleanup; without this every
  // render stacks up and the queries match the previous test's banner.
  cleanup();
  holdShift(false);
});

describe('ModifierHintBanner', () => {
  it('says nothing when no modifier is worth naming', () => {
    show();
    expect(screen.queryByText(/shift/i)).toBeNull();
  });

  it('names what Shift is doing while it is held', () => {
    show();
    holdShift(true);
    expect(screen.getByText(/click elements to select several/i)).toBeTruthy();
  });

  it('is suppressed while a mode banner owns the slot', () => {
    show({ suppressed: true });
    holdShift(true);
    expect(screen.queryByText(/click elements to select several/i)).toBeNull();
  });

  it('names the aspect lock while resizing, and nothing while moving', () => {
    const { rerender } = show({ drag: { kind: 'boxed', mode: 'resize-se' } as DragState });
    holdShift(true);
    expect(screen.getByText(/proportions locked/i)).toBeTruthy();
    rerender(
      <ModifierHintBanner
        drag={{ kind: 'boxed', mode: 'move' } as DragState}
        hasElements
        suppressed={false}
      />,
    );
    expect(screen.queryByText(/proportions locked|select several/i)).toBeNull();
  });
});
