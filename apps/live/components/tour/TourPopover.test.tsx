// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { planPalette } from '@livediagram/document';
import { TourPopover } from './TourPopover';

// docs/specs/007-editor/editor-tour.md "The centred cards take the keyboard".
const props = {
  stepNumber: 0,
  stepCount: 5,
  stepId: 'welcome',
  stepDir: 'forward' as const,
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
  it('moves focus onto the welcome card itself, and back when it goes', () => {
    const before = focusedButton();
    const { unmount } = render(<TourPopover {...props} card="welcome" />);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    unmount();
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('puts focus back when the offer turns into a step', () => {
    const before = focusedButton();
    const { rerender } = render(<TourPopover {...props} card="welcome" />);
    rerender(<TourPopover {...props} stepId="palette" stepNumber={1} />);
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('takes focus for the last card too', () => {
    render(<TourPopover {...props} stepId="outro" card="outro" />);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('leaves focus where it is for a step card', () => {
    const before = focusedButton();
    render(<TourPopover {...props} stepId="palette" stepNumber={1} />);
    expect(document.activeElement).toBe(before);
    expect(screen.getByRole('dialog').hasAttribute('tabindex')).toBe(false);
    before.remove();
  });
});
