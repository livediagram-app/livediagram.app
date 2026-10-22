// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { planPalette } from '@livepages/document';
import { TourPopover } from './TourPopover';

// docs/specs/007-editor/editor-tour.md: a step card leaves focus on the control it points at.
const props = {
  stepNumber: 0,
  stepCount: 5,
  stepId: 'palette',
  title: 'Getting started with Diagrams?',
  body: 'Want a quick tour?',
  targetRect: null,
  palette: planPalette('light'),
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
