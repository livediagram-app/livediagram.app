// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { TourPopover } from './TourPopover';

// docs/specs/007-editor/editor-tour.md: a step card leaves focus on the control it points at.
const props = {
  stepNumber: 0,
  stepCount: 5,
  stepId: 'palette',
  title: 'The Palette',
  body: 'Add whatever you need.',
  targetRect: null,
  colours: { '--tour-accent': '#0369a1' } as CSSProperties,
  onNext: () => undefined,
  onSkip: () => undefined,
};

function focusedButton(): HTMLButtonElement {
  const before = document.createElement('button');
  document.body.appendChild(before);
  before.focus();
  return before;
}

describe('TourPopover focus', () => {
  it('leaves focus where it is for a step card', () => {
    const before = focusedButton();
    render(<TourPopover {...props} stepNumber={1} />);
    expect(document.activeElement).toBe(before);
    expect(screen.getByRole('dialog').hasAttribute('tabindex')).toBe(false);
    before.remove();
  });
});

// docs/specs/007-editor/editor-tour.md "Keyboard": Escape skips, the arrows step.
describe('TourPopover keys', () => {
  afterEach(cleanup);

  function keyed() {
    const on = { onNext: vi.fn(), onBack: vi.fn(), onSkip: vi.fn() };
    render(<TourPopover {...props} stepNumber={2} {...on} />);
    return on;
  }

  it('steps with the arrows and skips with Escape', () => {
    const on = keyed();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(on.onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(on.onBack).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(on.onSkip).toHaveBeenCalledTimes(1);
  });

  it('leaves the arrows to a field being typed in, and to a modified press', () => {
    const on = keyed();
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(document, { key: 'ArrowLeft', metaKey: true });
    expect(on.onNext).not.toHaveBeenCalled();
    expect(on.onBack).not.toHaveBeenCalled();
    field.remove();
  });

  it('has no Back on the first step, so the left arrow does nothing', () => {
    const onNext = vi.fn();
    render(<TourPopover {...props} stepNumber={1} onNext={onNext} />);
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('takes the arrows before a menu a step opened, which would step through its own items', () => {
    const on = keyed();
    const menu = document.createElement('div');
    const item = document.createElement('button');
    menu.append(item);
    document.body.append(menu);
    const menuArrow = vi.fn((e: KeyboardEvent) => e.preventDefault());
    menu.addEventListener('keydown', menuArrow);
    fireEvent.keyDown(item, { key: 'ArrowRight' });
    expect(on.onNext).toHaveBeenCalledTimes(1);
    expect(menuArrow).not.toHaveBeenCalled();
    menu.remove();
  });
});

// docs/specs/007-editor/editor-tour.md "The last card": the last card is the step card, never a banner.
describe('TourPopover last card', () => {
  afterEach(cleanup);
  const outro = { eyebrow: 'Draw tour', helpHref: '/help/draw/', finish: 'Start' };

  it('swaps the count and Next for its eyebrow, the help link and the finish button', () => {
    const onNext = vi.fn();
    const onSkip = vi.fn();
    render(
      <TourPopover
        {...props}
        stepNumber={4}
        title="You're ready to draw"
        outro={outro}
        onNext={onNext}
        onSkip={onSkip}
      />,
    );
    expect(screen.getByRole('dialog', { name: "Tour: You're ready to draw" })).toBeTruthy();
    expect(screen.getByText('Draw tour')).toBeTruthy();
    expect(screen.queryByText('4 of 5')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip tour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Learn More' }).getAttribute('href')).toBe(
      '/help/draw/',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('finishes on Escape, as its finish button does', () => {
    const onNext = vi.fn();
    const onSkip = vi.fn();
    render(<TourPopover {...props} outro={outro} onNext={onNext} onSkip={onSkip} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });
});

// docs/specs/007-editor/editor-tour.md: while the next step prepares, the card's buttons wait.
describe('TourPopover busy', () => {
  afterEach(cleanup);

  it("waits on a keyboard press of Next or Back too (a focused button's Enter is a click)", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    const { rerender } = render(
      <TourPopover {...props} stepNumber={2} busy onNext={onNext} onBack={onBack} />,
    );
    const next = screen.getByRole('button', { name: 'Next' });
    const back = screen.getByRole('button', { name: 'Back' });
    expect(next.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(next);
    fireEvent.click(back);
    expect(onNext).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    rerender(<TourPopover {...props} stepNumber={2} onNext={onNext} onBack={onBack} />);
    expect(next.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(next);
    fireEvent.click(back);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// "Where the card sits" (docs/specs/007-editor/editor-tour.md): on a phone a card too tall for either side of its target
// takes the side with more room, capped to it, so it never covers the control it is about; and it is placed again when
// the visible viewport changes (a phone's keyboard).
describe('TourPopover on a phone', () => {
  const sized = (width: number, height: number) => {
    const w = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
    const h = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
    return () => {
      w.mockRestore();
      h.mockRestore();
    };
  };
  const view = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  };
  afterEach(() => {
    cleanup();
    view(1024, 768);
  });
  const card = () => screen.getByRole('dialog');
  const box = () => {
    const s = card().style;
    return { top: parseFloat(s.top), maxHeight: s.maxHeight ? parseFloat(s.maxHeight) : null };
  };

  it('caps a tall card to the room below a target mid-screen, clear of it', () => {
    view(390, 844);
    const restore = sized(352, 520);
    const target = { left: 16, top: 300, width: 340, height: 44 };
    render(<TourPopover {...props} targetRect={target} />);
    const { top, maxHeight } = box();
    expect(top).toBeGreaterThanOrEqual(target.top + target.height);
    expect(maxHeight).toBe(844 - 8 - top);
    restore();
  });

  it('caps it to the room above a target low on the screen, ending above it', () => {
    view(390, 844);
    const restore = sized(352, 620);
    const target = { left: 230, top: 600, width: 40, height: 44 };
    render(<TourPopover {...props} targetRect={target} />);
    const { top, maxHeight } = box();
    expect(top).toBe(8);
    expect(top + (maxHeight ?? 0)).toBeLessThanOrEqual(target.top);
    restore();
  });

  it('places itself again when the visible viewport resizes', () => {
    view(390, 844);
    const restore = sized(352, 200);
    const listeners: Record<string, () => void> = {};
    const vv = {
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    const target = { left: 16, top: 300, width: 340, height: 44 };
    const { unmount } = render(<TourPopover {...props} targetRect={target} />);
    expect(box().top).toBe(356);
    // The keyboard comes up: the window is now 500px tall, so the card fits only above.
    view(390, 500);
    act(() => listeners.resize?.());
    expect(box().top).toBe(300 - 12 - 200);
    unmount();
    expect(vv.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    restore();
  });
});
