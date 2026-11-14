// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnchoredPopover } from './AnchoredPopover';

// Opening focuses the popover's first control and Escape hands focus back to the anchor; with `preventScroll` neither
// scrolls anything, so an anchor in a sideways-scrolling row (a board header's widgets) keeps the row where it was.
afterEach(cleanup);

function open(preventScroll?: boolean) {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const anchorFocus = vi.spyOn(anchor, 'focus');
  const firstFocus = vi.spyOn(HTMLButtonElement.prototype, 'focus');
  render(
    <AnchoredPopover
      anchor={anchor}
      name="Labels values"
      width={240}
      onClose={() => undefined}
      {...(preventScroll === undefined ? {} : { preventScroll })}
    >
      <button type="button">Bug</button>
    </AnchoredPopover>,
  );
  return { anchorFocus, firstFocus };
}

describe('AnchoredPopover focus', () => {
  it('moves the focus in and back without scrolling when asked', () => {
    const { anchorFocus, firstFocus } = open(true);
    expect(firstFocus).toHaveBeenCalledWith({ preventScroll: true });
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(anchorFocus).toHaveBeenLastCalledWith({ preventScroll: true });
    firstFocus.mockRestore();
  });

  it('scrolls a focused control into view as before, by default', () => {
    const { firstFocus } = open();
    expect(firstFocus).toHaveBeenCalledWith({ preventScroll: false });
    firstFocus.mockRestore();
  });
});
