// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARD_TYPE_TOUR_STEPS, type CardTypeTourApi } from './card-type-tour-steps';
import { CardTypeShowMeButton, CardTypeTourStage, useCardTypeTour } from './CardTypeTour';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The tour wears the active tab's colours (tour-colours.ts); outside an editor, a plain light palette.
vi.mock('@/components/start/useStartPalette', async () => {
  const { planPalette } = await import('@liveplanner/project');
  return { useStartPalette: () => planPalette('light') };
});
// jsdom lays nothing out, so "on screen" is just "in the project" here.
vi.mock('./tour-dom', async (actual) => ({
  ...(await actual<typeof import('./tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));
afterEach(cleanup);

// docs/specs/026-plan/item-types.md "Editing a type": Show Me, never offered, run on the editor itself.
function Editor({ showTab }: { showTab: (tab: string) => void }) {
  const tour = useCardTypeTour(showTab);
  return (
    <div>
      <CardTypeShowMeButton tour={tour} />
      <div data-tour-id="card-type-general">
        <input aria-label="Name" />
      </div>
      <CardTypeTourStage tour={tour} />
    </div>
  );
}

describe('Show Me', () => {
  // The engine scrolls it there (tour-reveal.ts): Fields sits under General, below the panel's fold.
  it('brings Configuration’s Fields section to the top of the panel for its step', async () => {
    const fields = CARD_TYPE_TOUR_STEPS.find((s) => s.id === 'fields')!;
    expect(fields.revealAt).toBe('start');
    const showTab = vi.fn();
    await fields.prepare!({ showTab });
    expect(showTab).toHaveBeenCalledWith('configuration');
  });

  it('starts on its first step when pressed, opens Configuration and puts the caret in Name', async () => {
    const showTab = vi.fn();
    render(<Editor showTab={showTab} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 1 of 5: Name It, Then Give It a Look/ }),
    ).toBeTruthy();
    expect(showTab).toHaveBeenCalledWith('configuration');
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
    expect(screen.getByRole('button', { name: 'Show Me' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('opens each step’s tab, and ends on a closing card', () => {
    const tabs = CARD_TYPE_TOUR_STEPS.map((s) => {
      const showTab = vi.fn<CardTypeTourApi['showTab']>();
      void s.prepare?.({ showTab });
      return showTab.mock.calls[0]?.[0];
    });
    expect(tabs).toEqual([
      'configuration',
      'configuration',
      'statuses',
      'display',
      undefined,
      undefined,
    ]);
    expect(CARD_TYPE_TOUR_STEPS.at(-1)?.card).toBe('outro');
    expect(CARD_TYPE_TOUR_STEPS.some((s) => s.card === 'welcome')).toBe(false);
  });
});
