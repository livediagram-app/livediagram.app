// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmPopover } from './ConfirmPopover';

// Where the popover sits beside its anchor, and that it never leaves the screen.
function anchorAt(left: number, right: number): HTMLElement {
  const anchor = document.createElement('button');
  document.body.append(anchor);
  anchor.getBoundingClientRect = () =>
    ({
      left,
      right,
      top: 400,
      bottom: 440,
      width: right - left,
      height: 40,
      x: left,
      y: 400,
    }) as DOMRect;
  return anchor;
}

function open(anchor: HTMLElement) {
  render(
    <ConfirmPopover
      anchor={anchor}
      message="Delete this?"
      confirmLabel="Delete"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  const panel = screen.getByRole('alertdialog');
  return { left: parseFloat(panel.style.left), arrow: panel.querySelector('span[aria-hidden]') };
}

const width = window.innerWidth;
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  for (const a of document.querySelectorAll('body > button')) a.remove();
});

describe('ConfirmPopover placement', () => {
  it('sits to the left of an anchor with room there, arrow pointing at it', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    const { left, arrow } = open(anchorAt(600, 800));
    expect(left).toBe(600 - 10 - 240);
    expect(arrow).not.toBeNull();
  });

  it('flips to the right when the left has no room', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    const { left } = open(anchorAt(20, 200));
    expect(left).toBe(210);
  });

  it('stays on a phone screen when the anchor spans it, with no arrow', () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    const { left, arrow } = open(anchorAt(0, 390));
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + 240).toBeLessThanOrEqual(390);
    expect(arrow).toBeNull();
  });
});
