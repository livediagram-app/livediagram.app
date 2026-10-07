// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import { AnchoredPopover, placeAnchored } from './AnchoredPopover';

// docs/specs/026-plan/item-types.md "Editing a type": Add Field's and Glyph's popovers.
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
