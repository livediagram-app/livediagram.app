// @vitest-environment jsdom

// The facilitator's menu on an element somebody else is holding (docs/specs/007-editor/live-app.md lock
// + docs/specs/012-collaboration/facilitator.md). Two things worth pinning: it names whose hold it would break —
// an action you cannot judge otherwise — and, being portalled, it keeps its
// events off the canvas underneath, the same trap ElementEllipsisMenu carries.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LockedElementMenu } from './LockedElementMenu';

afterEach(cleanup);

const ARIEL = { id: 'p1', name: 'Ariel', color: '#f00' };
const PETE = { id: 'p2', name: 'Pete', color: '#0f0' };

function mount(
  holders = [ARIEL],
  handlers: { onRelease?: (id: string) => void; onClose?: () => void } = {},
) {
  const onRelease = handlers.onRelease ?? vi.fn();
  const onClose = handlers.onClose ?? vi.fn();
  render(
    <div onClick={() => {}}>
      <LockedElementMenu
        at={{ x: 100, y: 100 }}
        holders={holders}
        onRelease={onRelease}
        onClose={onClose}
      />
    </div>,
  );
  return { onRelease, onClose };
}

describe('LockedElementMenu', () => {
  it('names the person whose hold it would break', () => {
    mount();
    expect(screen.getByRole('menuitem', { name: /Release Ariel’s hold/ })).toBeTruthy();
  });

  it('lists every holder when more than one has it', () => {
    mount([ARIEL, PETE]);
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('releases that holder by presence id, then closes', () => {
    const { onRelease, onClose } = mount([ARIEL, PETE]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Pete/ }));
    expect(onRelease).toHaveBeenCalledWith('p2');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('says the holder keeps their work, because "release" sounds destructive', () => {
    mount();
    expect(screen.getByText(/keep their work/i)).toBeTruthy();
  });

  it('closes on Escape', () => {
    const { onClose } = mount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on a pointerdown outside it', () => {
    const { onClose } = mount();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close on a pointerdown inside it', () => {
    const { onClose } = mount();
    fireEvent.pointerDown(screen.getByRole('menu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps its events off the canvas beneath', () => {
    // Portalled into document.body, but React still bubbles to the component
    // that rendered it — which here is the canvas the locked element sits on.
    const onCanvasClick = vi.fn();
    const onCanvasDoubleClick = vi.fn();
    render(
      <div onClick={onCanvasClick} onDoubleClick={onCanvasDoubleClick}>
        <LockedElementMenu
          at={{ x: 10, y: 10 }}
          holders={[ARIEL]}
          onRelease={vi.fn()}
          onClose={vi.fn()}
        />
      </div>,
    );
    const menu = screen.getAllByRole('menu')[0]!;
    fireEvent.click(menu);
    fireEvent.doubleClick(menu);
    expect(onCanvasClick).not.toHaveBeenCalled();
    expect(onCanvasDoubleClick).not.toHaveBeenCalled();
  });
});
