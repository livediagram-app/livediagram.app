// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@liveworkspace/workbench/lib/clamp-to-viewport';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { standardGroup } from '@/components/colour/colour-options';
import {
  AnchoredPopover,
  placeAnchored,
} from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { ConfirmPopover } from '@liveworkspace/workbench/components/primitives/ConfirmPopover';
import { openPopoverCount } from '@liveworkspace/workbench/components/primitives/popover-stack';

afterEach(cleanup);

const view = { width: 1000, height: 800 };

describe('placeAnchored', () => {
  it('opens under the anchor, left-aligned, with the room below as its limit', () => {
    expect(
      placeAnchored({ left: 100, top: 100, bottom: 130 }, { width: 300, height: 200 }, view),
    ).toEqual({ left: 100, side: 'below', top: 136, maxHeight: view.height - 136 - EDGE });
  });

  it('opens above when only above has room, held by its bottom edge, left edge on-screen', () => {
    const at = placeAnchored(
      { left: 900, top: 700, bottom: 730 },
      { width: 300, height: 200 },
      view,
    );
    expect(at).toEqual({
      left: view.width - 300 - EDGE,
      side: 'above',
      bottom: view.height - 694,
      maxHeight: 694 - EDGE,
    });
  });

  it('keeps the side it opened on however tall it grows', () => {
    const anchor = { left: 0, top: 500, bottom: 530 };
    expect(placeAnchored(anchor, { width: 300, height: 100 }, view).side).toBe('below');
    expect(placeAnchored(anchor, { width: 300, height: 600 }, view, 'below').side).toBe('below');
  });
});

// tooltips-hover-cards-popovers.md "On-screen keyboard": a window shrunk under the panel (a keyboard that resizes
// it) never squeezes it to nothing; it keeps MIN_ROOM_PX (or its own height, when smaller) and is moved into view.
describe('placeAnchored with almost no room', () => {
  it('keeps the least room on its side, or the panel’s own height when that is less', async () => {
    const { MIN_ROOM_PX } =
      await import('@liveworkspace/workbench/components/primitives/AnchoredPopover');
    const short = { width: 1000, height: 420 };
    const anchor = { left: 0, top: 380, bottom: 400 };
    expect(placeAnchored(anchor, { width: 300, height: 400 }, short, 'below').maxHeight).toBe(
      MIN_ROOM_PX,
    );
    expect(placeAnchored(anchor, { width: 300, height: 90 }, short, 'below').maxHeight).toBe(90);
    expect(
      placeAnchored({ left: 0, top: 10, bottom: 30 }, { width: 300, height: 400 }, view, 'above')
        .maxHeight,
    ).toBe(MIN_ROOM_PX);
  });
});

describe('AnchoredPopover', () => {
  const draw = () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);
    const onClose = vi.fn();
    render(
      <AnchoredPopover anchor={anchor} name="Add Field" width={300} onClose={onClose}>
        <input aria-label="Name" />
      </AnchoredPopover>,
    );
    return { anchor, onClose };
  };

  it('focuses its first control, and Escape closes it and hands focus back', () => {
    const { anchor, onClose } = draw();
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(anchor);
    anchor.remove();
  });

  it('closes on a press outside, but not on its anchor or inside it', () => {
    const { anchor, onClose } = draw();
    fireEvent.pointerDown(screen.getByLabelText('Name'));
    fireEvent.pointerDown(anchor);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
    anchor.remove();
  });
});

// A popover opened from inside another (a cog's Style section opening a colour picker, a ConfirmPopover): the stack
// in popover-stack.ts gives Escape and presses to the one on top.
describe('AnchoredPopover nested in another', () => {
  function Cog({ onClose, confirm = false }: { onClose: () => void; confirm?: boolean }) {
    const [cog, setCog] = useState<HTMLElement | null>(null);
    const [ask, setAsk] = useState<HTMLElement | null>(null);
    return (
      <div>
        <button ref={setCog}>Settings</button>
        {cog ? (
          <AnchoredPopover anchor={cog} name="Slot Settings" width={240} onClose={onClose}>
            <p>Style</p>
            <ColourSwatchButton
              label="Fill"
              standard={[standardGroup('strong', 'light', 'hex')]}
              value={null}
              swatch="#000"
              onPick={vi.fn()}
            />
            {confirm ? <button onClick={(e) => setAsk(e.currentTarget)}>Delete</button> : null}
            {ask ? (
              <ConfirmPopover
                anchor={ask}
                message="Delete it?"
                confirmLabel="Delete"
                onConfirm={() => setAsk(null)}
                onCancel={() => setAsk(null)}
              />
            ) : null}
          </AnchoredPopover>
        ) : null}
      </div>
    );
  }

  it('closes only the colour picker on Escape, handing focus back to its swatch', () => {
    const onClose = vi.fn();
    render(<Cog onClose={onClose} />);
    const swatch = screen.getByRole('button', { name: 'Fill' });
    fireEvent.click(swatch);
    expect(screen.getByRole('dialog', { name: 'Fill' })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Fill' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(swatch);
    // The next Escape is the cog's.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the cog open on a press inside the colour picker, closing the picker on one in the cog', () => {
    const onClose = vi.fn();
    render(<Cog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Blue' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText('Style'));
    expect(screen.queryByRole('dialog', { name: 'Fill' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lets a ConfirmPopover it opened take Escape, the cog staying open', () => {
    const onClose = vi.fn();
    render(<Cog onClose={onClose} confirm />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(document.querySelector('[data-confirm-popover]')).not.toBeNull();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(document.querySelector('[data-confirm-popover]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves the stack empty once everything is closed', () => {
    const { unmount } = render(<Cog onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    expect(openPopoverCount()).toBe(2);
    unmount();
    expect(openPopoverCount()).toBe(0);
  });
});
