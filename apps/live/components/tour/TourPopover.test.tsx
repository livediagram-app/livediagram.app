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
  it('leaves focus where it is for the offer, which asks nothing of the editor', () => {
    const before = focusedButton();
    const { unmount } = render(<TourPopover {...props} card="welcome" />);
    expect(document.activeElement).toBe(before);
    unmount();
    before.remove();
  });

  it('puts focus back when the offer turns into a step', () => {
    const before = focusedButton();
    const { rerender } = render(<TourPopover {...props} card="welcome" />);
    rerender(<TourPopover {...props} stepId="palette" stepNumber={1} />);
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('nor for the last card', () => {
    const before = focusedButton();
    render(<TourPopover {...props} stepId="outro" card="outro" />);
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('leaves focus where it is for a step card', () => {
    const before = focusedButton();
    render(<TourPopover {...props} stepId="palette" stepNumber={1} />);
    expect(document.activeElement).toBe(before);
    expect(screen.getByRole('dialog').hasAttribute('tabindex')).toBe(false);
    before.remove();
  });
});

describe('bookend cards at the bottom', () => {
  it('stand centred on the chrome floor', async () => {
    const { bookendPlace } = await import('./TourPopover');
    expect(bookendPlace({ width: 336, height: 200 }, { width: 1440, height: 900 }, 64)).toEqual({
      left: 552,
      top: 636,
    });
    // Never off the top of a short window.
    expect(bookendPlace({ width: 336, height: 600 }, { width: 400, height: 500 }, 64).top).toBe(0);
  });

  it('tell the body one is up while they are, so the sign-in banner steps aside', async () => {
    const { TOUR_CARD_ATTR } = await import('./TourPopover');
    const { unmount } = render(<TourPopover {...props} card="welcome" />);
    expect(document.body.hasAttribute(TOUR_CARD_ATTR)).toBe(true);
    expect(screen.getByRole('dialog').hasAttribute('data-toast-floor')).toBe(true);
    unmount();
    expect(document.body.hasAttribute(TOUR_CARD_ATTR)).toBe(false);
  });

  it('a step card does not', async () => {
    const { TOUR_CARD_ATTR } = await import('./TourPopover');
    render(<TourPopover {...props} stepId="palette" stepNumber={1} />);
    expect(document.body.hasAttribute(TOUR_CARD_ATTR)).toBe(false);
  });
});
