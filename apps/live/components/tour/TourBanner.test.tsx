// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planPalette } from '@livediagram/document';
import { TOUR_CARD_ATTR, TourBanner } from './TourBanner';
import { WELCOME_TOUR_COPY } from './tour-card-copy';

// docs/specs/007-editor/editor-tour.md "The bookend cards ask nothing of the editor": the offer and the last card are a
// banner at the bottom, as the sign-in banner is.
afterEach(cleanup);

const open = (card: 'welcome' | 'outro' = 'welcome') => {
  const onNext = vi.fn();
  const onSkip = vi.fn();
  const view = render(
    <TourBanner
      card={card}
      title="Getting started with Diagrams?"
      body="Want a quick tour?"
      copy={WELCOME_TOUR_COPY}
      palette={planPalette('light')}
      onNext={onNext}
      onSkip={onSkip}
    />,
  );
  return { onNext, onSkip, view };
};

describe('TourBanner', () => {
  it('is a wide row at the bottom: the picture, the words, then No and Yes', () => {
    open();
    const banner = screen.getByRole('dialog', { name: 'Getting started with Diagrams?' });
    expect(banner.className).toContain('max-w-3xl');
    expect(banner.className).toContain('sm:flex-row');
    expect(banner.parentElement!.className).toContain('fixed inset-x-0');
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['No', 'Yes']);
  });

  it('leaves focus where it is and takes no backdrop', () => {
    const before = document.createElement('button');
    document.body.append(before);
    before.focus();
    open();
    expect(document.activeElement).toBe(before);
    before.remove();
  });

  it('tells the body it is up, so the sign-in banner steps aside, and stands as the toasts’ floor', () => {
    const { view } = open();
    expect(document.body.hasAttribute(TOUR_CARD_ATTR)).toBe(true);
    expect(screen.getByRole('dialog').hasAttribute('data-toast-floor')).toBe(true);
    view.unmount();
    expect(document.body.hasAttribute(TOUR_CARD_ATTR)).toBe(false);
  });

  it('takes Escape only from inside itself', () => {
    const { onSkip } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).not.toHaveBeenCalled();
    const no = screen.getByRole('button', { name: 'No' });
    no.focus();
    fireEvent.keyDown(no, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('ends the tour from the last card with its finish button and Escape', () => {
    const { onNext } = open('outro');
    fireEvent.click(screen.getByRole('button', { name: WELCOME_TOUR_COPY.finish }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: WELCOME_TOUR_COPY.helpLabel })).toBeTruthy();
  });
});
