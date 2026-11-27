// @vitest-environment jsdom

// The bottom bar's right-hand cluster (docs/specs/007-editor/editor-app.md "Tab bar"): Get Started, when a tour is on
// offer, leads it, immediately left of Tools, then Settings; with no tour on offer, Tools leads. Version History is a
// row inside Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md).

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  publishTourOffer,
  resetTourOffersForTests,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import { resetTourOfferButtonForTests } from '@liveworkspace/workbench/components/tour/TourOfferButton';
import { ChromeControls } from './ChromeControls';

afterEach(() => {
  cleanup();
  act(() => resetTourOffersForTests());
  resetTourOfferButtonForTests();
});

const controls = () =>
  [...screen.getByTestId('bar').querySelectorAll('button, a')].map((el) =>
    el.getAttribute('aria-label'),
  );

function Bar({ onOpenHistory }: { onOpenHistory?: () => void }) {
  return (
    <div data-testid="bar">
      <ChromeControls
        onOpenSearch={() => {}}
        onOpenHistory={onOpenHistory}
        onOpenSettings={() => {}}
        labelled
        appearance={false}
        github={false}
      />
    </div>
  );
}

describe('ChromeControls order', () => {
  it('puts Get Started first, immediately left of Tools, then Settings', () => {
    render(<Bar />);
    act(() => publishTourOffer('draw', { id: 'draw', name: 'Draw', rank: 1, start: () => {} }));
    const order = controls();
    expect(order[0]).toBe('Get Started, Start Draw Tour');
    expect(order[1]).toBe('Tools');
    expect(order.indexOf('Settings')).toBeGreaterThan(1);
    expect(order).not.toContain('Search');
  });

  it('leads with Tools while no tour is on offer', () => {
    render(<Bar />);
    expect(controls()[0]).toBe('Tools');
    expect(controls().some((c) => c?.startsWith('Get Started'))).toBe(false);
  });
});

describe('ChromeControls History', () => {
  // Version History is a row in Tools now (footer-tools-menu.md), never a button of its own in the bar.
  it('adds no button to the bar, the editor offering it or not', () => {
    render(<Bar onOpenHistory={() => {}} />);
    expect(controls()).toEqual(['Tools', 'Settings', 'Notifications']);
    cleanup();
    render(<Bar />);
    expect(controls()).toEqual(['Tools', 'Settings', 'Notifications']);
  });
});

describe('ChromeControls on a phone', () => {
  // Work Tracker 1508 (editor-app.md "Tab bar"): a phone's bar gives the tabs the room of the bell and the light /
  // dark switch, so the pair is hidden there; with no bell on screen a leaving toast fades where it is.
  it('hides the bell and the appearance as one pair under the phone variant', () => {
    render(<Bar />);
    const bell = screen.getByRole('button', { name: /^Notifications/ });
    expect(bell.closest('[class~="phone:hidden"]')).not.toBeNull();
  });
});
