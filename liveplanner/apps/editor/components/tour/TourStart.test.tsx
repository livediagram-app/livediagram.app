// @vitest-environment jsdom

// The hands-on tours' start panel (docs/specs/026-plan/plan-tour.md "Starting a tour"): one track says what will
// happen and offers its button; several are listed, each ticked once taken; Not Now closes it.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourStart } from './TourStart';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('TourStart', () => {
  it('says what a single track does, how many missions, and starts it from its button', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <TourStart
        name="Sheets Tour"
        heading="Five Small Wins"
        line="A practice budget opens in a sheet of its own."
        tracks={[{ id: 'sheets', title: 'Five Small Wins', line: '', missions: 5, taken: false }]}
        startLabel="Open the Practice Sheet"
        onPick={onPick}
        onClose={onClose}
      />,
    );
    const region = screen.getByRole('region', { name: 'Sheets Tour' });
    expect(screen.getByRole('heading', { name: 'Five Small Wins' })).toBeTruthy();
    expect(region.textContent).toContain('A practice budget opens in a sheet of its own.');
    expect(region.textContent).toContain('5 quick missions');
    expect(document.querySelector('[data-tour-track]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open the Practice Sheet' }));
    expect(onPick).toHaveBeenCalledWith('sheets');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says one mission, leaves the count out when unknown, and defaults its button to Start', () => {
    const onPick = vi.fn();
    const { rerender } = render(
      <TourStart
        name="Tour"
        heading="H"
        line="L"
        tracks={[{ id: 'a', title: 'A', line: '', missions: 1, taken: false }]}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('region', { name: 'Tour' }).textContent).toContain('1 quick mission');
    expect(screen.getByRole('region', { name: 'Tour' }).textContent).not.toContain('missions');
    rerender(
      <TourStart
        name="Tour"
        heading="H"
        line="L"
        tracks={[{ id: 'a', title: 'A', line: '', taken: false }]}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('region', { name: 'Tour' }).textContent).not.toContain('quick');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('lists several tracks with their lines, ticks a taken one, and picks by row', () => {
    const onPick = vi.fn();
    render(
      <TourStart
        name="Boards Tour"
        heading="What would you like to learn?"
        line="Each track is a few quick missions."
        tracks={[
          { id: 'boards', title: 'Using a Board', line: 'Add and move cards.', taken: true },
          { id: 'card-types', title: 'Card Types', line: 'Make a kind of card.', taken: false },
        ]}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );
    const rows = [...document.querySelectorAll<HTMLElement>('[data-tour-track]')];
    expect(rows.map((r) => r.dataset.tourTrack)).toEqual(['boards', 'card-types']);
    expect(rows[0]!.textContent).toContain('Using a Board');
    expect(rows[0]!.textContent).toContain('Add and move cards.');
    expect(rows[0]!.textContent).toContain('Done');
    expect(rows[1]!.textContent).not.toContain('Done');
    fireEvent.click(rows[1]!);
    expect(onPick).toHaveBeenCalledWith('card-types');
  });

  it('closes on Not Now', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <TourStart
        name="Boards Tour"
        heading="H"
        line="L"
        tracks={[{ id: 'boards', title: 'B', line: '', taken: false }]}
        onPick={onPick}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Not Now Boards Tour' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });
});
