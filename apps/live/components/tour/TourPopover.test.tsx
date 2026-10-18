// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { planPalette } from '@livediagram/document';
import { TourPopover } from './TourPopover';

// docs/specs/007-editor/editor-tour.md: a step card leaves focus on the control it points at.
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
  it('leaves focus where it is for a step card', () => {
    const before = focusedButton();
    render(<TourPopover {...props} stepId="palette" stepNumber={1} />);
    expect(document.activeElement).toBe(before);
    expect(screen.getByRole('dialog').hasAttribute('tabindex')).toBe(false);
    before.remove();
  });
});
