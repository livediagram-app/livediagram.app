// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmPopover, useClickOutside } from '@liveworkspace/ui';
import { MOVABLE_PANEL_INSIDE } from './movable-panel-inside';

// A dismiss-on-outside panel (MovablePanel's useClickOutside with MOVABLE_PANEL_INSIDE) whose row asks a
// ConfirmPopover first, as the Trash's Delete Forever does. The confirm is portalled to the body, an alertdialog.
function Panel({ onOutside, onConfirm }: { onOutside: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  useClickOutside(ref, onOutside, true, MOVABLE_PANEL_INSIDE);
  return (
    <div ref={ref}>
      <button type="button" onClick={(e) => setAnchor(e.currentTarget)}>
        Delete Forever
      </button>
      {anchor ? (
        <ConfirmPopover
          anchor={anchor}
          message="Delete #3 for good? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={onConfirm}
          onCancel={() => setAnchor(null)}
        />
      ) : null}
    </div>
  );
}

afterEach(cleanup);

describe('MOVABLE_PANEL_INSIDE', () => {
  it("keeps a panel open under its own confirm, so the confirm's Delete runs", () => {
    const onOutside = vi.fn();
    const onConfirm = vi.fn();
    render(<Panel onOutside={onOutside} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Forever' }));
    const confirm = screen.getByRole('alertdialog');
    const del = screen.getByRole('button', { name: 'Delete' });
    fireEvent.pointerDown(del);
    fireEvent.click(del);
    expect(confirm.closest(MOVABLE_PANEL_INSIDE)).not.toBeNull();
    expect(onOutside).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('still closes the panel on a press outside it', () => {
    const onOutside = vi.fn();
    render(<Panel onOutside={onOutside} onConfirm={() => {}} />);
    fireEvent.pointerDown(document.body);
    expect(onOutside).toHaveBeenCalledTimes(1);
  });
});
