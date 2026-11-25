// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnchoredPopover } from './AnchoredPopover';

// A toast's press (its Undo of what was just done in the popover) leaves the popover open, so the undone work shows;
// any other press outside still closes it.
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function open() {
  const anchor = document.createElement('button');
  const toast = document.createElement('div');
  toast.setAttribute('data-toast-id', '1');
  const undo = document.createElement('button');
  toast.appendChild(undo);
  const elsewhere = document.createElement('div');
  document.body.append(anchor, toast, elsewhere);
  const onClose = vi.fn();
  render(
    <AnchoredPopover anchor={anchor} name="Notes" width={300} onClose={onClose}>
      <p>Body</p>
    </AnchoredPopover>,
  );
  return { undo, elsewhere, onClose };
}

const press = (el: Element) => {
  fireEvent.pointerDown(el);
  fireEvent.mouseDown(el);
  fireEvent.click(el);
};

describe('AnchoredPopover and a toast', () => {
  it('stays open for a press on a toast, and closes for any other outside press', () => {
    const { undo, elsewhere, onClose } = open();
    press(undo);
    expect(onClose).not.toHaveBeenCalled();
    press(elsewhere);
    expect(onClose).toHaveBeenCalled();
  });
});
