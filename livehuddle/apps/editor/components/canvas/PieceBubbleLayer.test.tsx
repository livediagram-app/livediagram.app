// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PieceBubbleHost, PieceBubblePortal } from './PieceBubbleLayer';

// docs/specs/009-elements/social-pieces.md "Arcade Machine" (Work Tracker 793): a piece's bubble draws over the
// characters, in the characters' layer's host, at the piece's box.

afterEach(cleanup);

const box = { x: 100, y: 300, width: 64, height: 112 };

describe('PieceBubblePortal', () => {
  it('draws in place with no host', () => {
    const { container } = render(
      <div data-face="">
        <PieceBubblePortal box={box}>
          <span>Insert Coin</span>
        </PieceBubblePortal>
      </div>,
    );
    expect(container.querySelector('[data-face]')!.textContent).toBe('Insert Coin');
  });

  it('draws in the raised host at the piece’s box, its clicks still reaching the face', () => {
    const onClick = vi.fn();
    const { container, unmount } = render(
      <>
        <button type="button" data-face="" onClick={onClick}>
          <PieceBubblePortal box={box}>
            <span>Insert Coin</span>
          </PieceBubblePortal>
        </button>
        <PieceBubbleHost />
      </>,
    );
    const host = container.querySelector<HTMLElement>('[data-piece-bubbles]')!;
    expect(host.className).toContain('z-[2]');
    expect(container.querySelector('[data-face]')!.textContent).toBe('');
    const placed = host.firstElementChild as HTMLElement;
    expect(placed.style.left).toBe('100px');
    expect(placed.style.top).toBe('300px');
    expect(placed.style.width).toBe('64px');
    fireEvent.click(screen.getByText('Insert Coin'));
    expect(onClick).toHaveBeenCalledTimes(1);
    unmount();
    // With the host gone, a face draws in place again.
    render(
      <div data-face="">
        <PieceBubblePortal box={box}>
          <span>Welcome</span>
        </PieceBubblePortal>
      </div>,
    );
    expect(document.querySelector('[data-face]')!.textContent).toBe('Welcome');
  });
});
