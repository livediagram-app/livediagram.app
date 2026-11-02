// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Slide, Tab } from '@livedocuments/document';
import { DEFAULT_PRESENTATION_CONFIG } from '@/lib/presentation-config';
import { track } from '@/lib/telemetry';
import { PresentationOverlay, type PresentationStep } from './PresentationOverlay';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/announcer', () => ({ announce: vi.fn() }));

// docs/specs/012-collaboration/speaker-note-cards.md "Presenting": the note cards in the running deck, for every
// role (presenting changes nothing).

const tab = { id: 't1', name: 'Tab', elements: [] } as unknown as Tab;
const slide = (id: string, extra: Partial<Slide> = {}): Slide => ({
  id,
  tabId: 't1',
  elementIds: [],
  ...extra,
});
const STEPS: PresentationStep[] = [
  {
    slide: slide('a', {
      noteCards: [
        { id: 'c1', text: 'First point' },
        { id: 'c2', text: '  ' },
        { id: 'c3', text: 'Second point' },
      ],
    }),
    tab,
    index: 0,
  },
  { slide: slide('b'), tab, index: 1 },
  // A slide written before note cards: its notes are one card.
  { slide: slide('c', { notes: 'An old note' }), tab, index: 2 },
];

function Deck({ onExit = vi.fn(), autoAdvanceSeconds = 0 }) {
  const [at, setAt] = useState(0);
  return (
    <PresentationOverlay
      steps={STEPS}
      canvasTool="select"
      onSetCanvasTool={vi.fn()}
      at={at}
      onGo={setAt}
      onExit={onExit}
      direction="forward"
      config={{ ...DEFAULT_PRESENTATION_CONFIG, autoAdvanceSeconds }}
      onChangeConfig={vi.fn()}
    />
  );
}

const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
const viewer = () => screen.queryByRole('dialog', { name: 'Presenter notes' });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PresentationOverlay note cards', () => {
  it('opens the cards with N, flips through them with the arrows, blank ones left out', () => {
    render(<Deck />);
    press('n');
    expect(viewer()!.textContent).toContain('Card 1 of 2');
    expect(viewer()!.textContent).toContain('First point');
    press('ArrowDown');
    expect(viewer()!.textContent).toContain('Card 2 of 2');
    expect(viewer()!.textContent).toContain('Second point');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'NoteCardFlip');
    // Past the last card the arrow goes nowhere, and never moves the slide.
    press('ArrowDown');
    expect(viewer()!.textContent).toContain('Card 2 of 2');
    press('ArrowUp');
    expect(viewer()!.textContent).toContain('Card 1 of 2');
    fireEvent.click(screen.getByRole('button', { name: 'Next Card' }));
    expect(viewer()!.textContent).toContain('Card 2 of 2');
  });

  it('stays open as the slide changes, hidden on a slide with none, on the first card of the next', () => {
    const onExit = vi.fn();
    render(<Deck onExit={onExit} />);
    press('n');
    press('ArrowDown');
    press('ArrowRight');
    expect(viewer()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Presenter notes' })).toBeNull();
    // Hidden notes are not what Esc closes: Esc on a slide with no cards leaves the deck.
    press('ArrowRight');
    expect(viewer()!.textContent).toContain('Card 1 of 1');
    expect(viewer()!.textContent).toContain('An old note');
    press('Escape');
    expect(viewer()).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
    press('ArrowLeft');
    press('Escape');
    expect(onExit).toHaveBeenCalled();
  });

  it('starts each slide on its first card', () => {
    render(<Deck />);
    press('n');
    press('ArrowDown');
    press('End');
    press('Home');
    expect(viewer()!.textContent).toContain('Card 1 of 2');
  });

  it('leaves N inert on a slide with no cards, and the arrows to the slides while the cards are shut', () => {
    render(<Deck />);
    press('ArrowRight');
    press('n');
    expect(viewer()).toBeNull();
    press('ArrowLeft');
    press('ArrowDown');
    expect(viewer()).toBeNull();
  });

  it('pauses auto-advance while the cards show, and not while they are hidden', () => {
    vi.useFakeTimers();
    render(<Deck autoAdvanceSeconds={5} />);
    press('n');
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(viewer()!.textContent).toContain('First point');
    fireEvent.click(screen.getByRole('button', { name: 'Presenter notes' }));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    // Advanced onto the slide with no cards.
    expect(screen.queryByRole('button', { name: 'Presenter notes' })).toBeNull();
  });
});
