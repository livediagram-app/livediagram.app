// @vitest-environment jsdom

// The `…` panel's event containment.
//
// The panel is PORTALLED to document.body, which moves it in the DOM but not in
// the React tree — React still bubbles its events to whatever component
// rendered the trigger, i.e. the canvas element the menu belongs to, however
// far apart the two are on screen. That is the whole hazard this file guards:
// the panel looks detached and behaves attached.
//
// It bit on double-click. The poll's panel is a form with text inputs, so
// double-clicking to select a word in a choice reached the element underneath,
// put it into text-edit mode, and the re-render took the panel away — the
// gesture for editing a choice was the gesture that closed the editor.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElementEllipsisMenu, ElementMenuItem } from './ElementEllipsisMenu';

afterEach(cleanup);

// The menu as the canvas mounts it: inside an element face that listens for the
// gestures the canvas cares about. The handlers stand in for select / enter
// text-edit-mode.
function mountInFace(handlers: { onClick?: () => void; onDoubleClick?: () => void }) {
  return render(
    <div onClick={handlers.onClick} onDoubleClick={handlers.onDoubleClick}>
      <ElementEllipsisMenu label="Poll options">
        {(close) => (
          <>
            <input aria-label="Choice" defaultValue="Ariel" />
            <ElementMenuItem onPress={close}>All settings…</ElementMenuItem>
          </>
        )}
      </ElementEllipsisMenu>
    </div>,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Poll options' }));
  return screen.getByRole('menu');
}

describe('ElementEllipsisMenu event containment', () => {
  it('does not leak a double-click in the panel to the element beneath', () => {
    const onDoubleClick = vi.fn();
    mountInFace({ onDoubleClick });
    const panel = openMenu();
    fireEvent.doubleClick(panel);
    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  it('does not leak a double-click INSIDE an input — selecting a word stays local', () => {
    // The reported symptom, at the exact target: you double-click a word in a
    // choice field, and the element underneath must not notice.
    const onDoubleClick = vi.fn();
    mountInFace({ onDoubleClick });
    openMenu();
    fireEvent.doubleClick(screen.getByLabelText('Choice'));
    expect(onDoubleClick).not.toHaveBeenCalled();
    // And the panel is still open, which is the half the user actually feels.
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('does not leak a click on the panel background', () => {
    const onClick = vi.fn();
    mountInFace({ onClick });
    const panel = openMenu();
    fireEvent.click(panel);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('still lets its own rows work', () => {
    // Containment must not come at the cost of the menu doing its job: the row
    // closes the panel.
    mountInFace({});
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'All settings…' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
