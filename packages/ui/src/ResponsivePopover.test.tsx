// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POPOVER_VIEWPORT_MARGIN as EDGE } from './popover';
import { ResponsivePopover, placeResponsivePopover } from './ResponsivePopover';

// A panel that opens from the control that asked for it: a popover under its anchor from `sm` up, a phone sheet
// below it, never in place in the page.

function matchMediaAs(wide: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        media: query,
        matches: wide,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function Host({ onClose = () => {} }: { onClose?: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button ref={setAnchor} type="button" onClick={() => setOpen(true)}>
        New Post
      </button>
      <p>Elsewhere</p>
      <ResponsivePopover
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        anchor={anchor}
        titleId="t"
      >
        <h2 id="t">New Post</h2>
        <input aria-label="Title" />
      </ResponsivePopover>
    </>
  );
}

const original = window.matchMedia;
afterEach(() => {
  cleanup();
  window.matchMedia = original;
});

describe('placeResponsivePopover', () => {
  const viewport = { width: 1200, height: 900 };

  it('opens under its anchor, its right edge on the anchor’s', () => {
    const place = placeResponsivePopover(
      { left: 900, right: 1000, top: 100, bottom: 140 },
      500,
      viewport,
      'end',
    );
    expect(place).toEqual({ left: 500, top: 148, maxHeight: 900 - 140 - 8 - EDGE, width: 500 });
  });

  it('lines up its left edge with `start`, and stays inside the window', () => {
    expect(
      placeResponsivePopover({ left: 100, right: 160, top: 0, bottom: 40 }, 500, viewport, 'start')
        .left,
    ).toBe(100);
    expect(
      placeResponsivePopover({ left: 0, right: 40, top: 0, bottom: 40 }, 500, viewport, 'end').left,
    ).toBe(EDGE);
    expect(
      placeResponsivePopover({ left: 0, right: 40, top: 0, bottom: 40 }, 5000, viewport, 'end')
        .width,
    ).toBe(1200 - EDGE * 2);
  });

  it('opens above when below is short and above has more room', () => {
    const place = placeResponsivePopover(
      { left: 900, right: 1000, top: 800, bottom: 840 },
      500,
      viewport,
      'end',
    );
    expect(place.top).toBeUndefined();
    expect(place.bottom).toBe(900 - 800 + 8);
  });
});

describe('ResponsivePopover', () => {
  it('is a labelled dialog portalled out of the page from sm up, closed by Escape', () => {
    matchMediaAs(true);
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    const panel = screen.getByRole('dialog', { name: 'New Post' });
    expect(panel.hasAttribute('data-responsive-popover')).toBe(true);
    act(() => {
      fireEvent.keyDown(panel, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a press outside it, but not on its anchor', () => {
    matchMediaAs(true);
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'New Post' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'New Post' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText('Elsewhere'));
    fireEvent.mouseDown(screen.getByText('Elsewhere'));
    expect(onClose).toHaveBeenCalled();
  });

  it('is a phone sheet below sm', () => {
    matchMediaAs(false);
    render(<Host />);
    const dialog = screen.getByRole('dialog', { name: 'New Post' });
    expect(dialog.hasAttribute('data-responsive-popover')).toBe(false);
    expect(screen.getByLabelText('Title')).toBeTruthy();
  });
});
