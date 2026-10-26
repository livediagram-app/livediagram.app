// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
