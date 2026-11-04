// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnchoredPopover } from './AnchoredPopover';

// The scrim closes the popover on its click, never on the press: closing on the press took the scrim away before a
// tap's click, which then landed on the anchor under it and opened the popover again.
afterEach(cleanup);

function open() {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const onClose = vi.fn();
  render(
    <AnchoredPopover anchor={anchor} name="Sort Cards" width={300} scrim onClose={onClose}>
      <p>Body</p>
    </AnchoredPopover>,
  );
  const scrim = document.querySelector<HTMLElement>('[data-anchored-popover-scrim]')!;
  return { scrim, onClose };
}

describe('AnchoredPopover scrim', () => {
  it('closes on its click, not on the press', () => {
    const { scrim, onClose } = open();
    fireEvent.pointerDown(scrim);
    fireEvent.mouseDown(scrim);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
