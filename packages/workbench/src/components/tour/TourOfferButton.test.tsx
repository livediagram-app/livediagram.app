// @vitest-environment jsdom
// The footer's Start Tour button (docs/specs/007-editor/editor-tour.md "Where it appears"): the one way into a tour,
// left of Search, offering the most relevant tour on offer, and absent with none.
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  publishTourOffer,
  resetTourOffersForTests,
  tourNameOf,
  tourOffer,
  TOUR_OFFER_RANK,
  useOfferTour,
} from './tour-offer';
import { resetTourOfferButtonForTests, startTourLabel, TourOfferButton } from './TourOfferButton';

afterEach(() => {
  cleanup();
  act(() => resetTourOffersForTests());
  resetTourOfferButtonForTests();
});

const offer = (id: string, name: string, rank: number, start = vi.fn()) => ({
  id,
  name,
  rank,
  start,
});

// The footer as each editor draws it: the tour button, then Search, Settings and the appearance switch.
function Footer({ labelled = true }: { labelled?: boolean }) {
  return (
    <div data-testid="footer">
      <TourOfferButton labelled={labelled} />
      <button type="button" aria-label="Search" />
      <button type="button" aria-label="Settings" />
      <button type="button" aria-label="System" />
    </div>
  );
}

describe('TourOfferButton', () => {
  it('draws nothing while no tour is on offer', () => {
    render(<Footer />);
    expect(screen.queryByRole('button', { name: /^Start .* Tour$/ })).toBeNull();
    expect(document.querySelector('[data-tour-offer]')).toBeNull();
  });

  it('names the tour, wears the play glyph and sits just before Search', () => {
    render(<Footer />);
    act(() => publishTourOffer('draw', offer('draw', 'Draw', TOUR_OFFER_RANK.mode)));
    const button = screen.getByRole('button', { name: 'Start Draw Tour' });
    expect(button.textContent).toBe('Start Draw Tour');
    expect(button.querySelector('svg')).not.toBeNull();
    const buttons = [...screen.getByTestId('footer').querySelectorAll<HTMLElement>('button')];
    const at = buttons.indexOf(button);
    expect(at).toBe(0);
    expect(buttons[at + 1]?.getAttribute('aria-label')).toBe('Search');
  });

  it('starts the tour on a press, and stays to be pressed again', () => {
    const start = vi.fn();
    render(<Footer />);
    act(() => publishTourOffer('draw', offer('draw', 'Draw', TOUR_OFFER_RANK.mode, start)));
    fireEvent.click(screen.getByRole('button', { name: 'Start Draw Tour' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Draw Tour' }));
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('keeps its name but drops its words where its neighbours drop theirs', () => {
    render(<Footer labelled={false} />);
    act(() => publishTourOffer('draw', offer('draw', 'Draw', TOUR_OFFER_RANK.mode)));
    const button = screen.getByRole('button', { name: 'Start Draw Tour' });
    expect(button.textContent).toBe('');
  });

  it('collapses to the glyph on a phone: its words are hidden below sm', () => {
    render(<Footer />);
    act(() => publishTourOffer('draw', offer('draw', 'Draw', TOUR_OFFER_RANK.mode)));
    const words = screen.getByText('Start Draw Tour');
    expect(words.className).toContain('hidden');
    expect(words.className).toContain('sm:inline');
  });

  it('says it was shown once per offer in a page load', () => {
    const onShown = vi.fn();
    const { rerender } = render(<Footer />);
    act(() => publishTourOffer('draw', { ...offer('draw', 'Draw', 1), onShown }));
    rerender(<Footer />);
    act(() => publishTourOffer('draw', null));
    act(() => publishTourOffer('draw', { ...offer('draw', 'Draw', 1), onShown }));
    expect(onShown).toHaveBeenCalledTimes(1);
  });
});

describe('tour offers', () => {
  it('offers the most specific tour, and the next one when it goes', () => {
    act(() => publishTourOffer('diagram', offer('diagram', 'Diagram', TOUR_OFFER_RANK.mode)));
    act(() => publishTourOffer('element', offer('element', 'Sankey', TOUR_OFFER_RANK.element)));
    act(() => publishTourOffer('avatar', offer('avatar', 'Avatar', TOUR_OFFER_RANK.tool)));
    expect(tourOffer()?.name).toBe('Sankey');
    act(() => publishTourOffer('element', null));
    expect(tourOffer()?.name).toBe('Avatar');
    act(() => publishTourOffer('avatar', null));
    expect(tourOffer()?.name).toBe('Diagram');
    act(() => publishTourOffer('diagram', null));
    expect(tourOffer()).toBeNull();
  });

  it('publishes a host offer while it is on, and takes it back when off or unmounted', () => {
    const start = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ on }: { on: boolean }) =>
        useOfferTour('draw', on ? { name: 'Draw', rank: TOUR_OFFER_RANK.mode, start } : null),
      { initialProps: { on: true } },
    );
    expect(tourOffer()?.name).toBe('Draw');
    tourOffer()?.start();
    expect(start).toHaveBeenCalledTimes(1);
    rerender({ on: false });
    expect(tourOffer()).toBeNull();
    rerender({ on: true });
    expect(tourOffer()?.name).toBe('Draw');
    unmount();
    expect(tourOffer()).toBeNull();
  });

  it('reads the start it was last given', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ start }: { start: () => void }) => useOfferTour('draw', { name: 'Draw', rank: 1, start }),
      { initialProps: { start: first } },
    );
    rerender({ start: second });
    tourOffer()?.start();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('labels a tour by its name', () => {
    expect(startTourLabel('Workshop')).toBe('Start Workshop Tour');
  });

  it('names an element tour from its eyebrow, in title case', () => {
    expect(tourNameOf('Sankey tour')).toBe('Sankey');
    expect(tourNameOf('Hub and spoke tour')).toBe('Hub and Spoke');
    expect(tourNameOf('Diagram key tour')).toBe('Diagram Key');
  });
});
