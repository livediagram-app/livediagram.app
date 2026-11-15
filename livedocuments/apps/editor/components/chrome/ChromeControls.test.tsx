// @vitest-environment jsdom

// The bottom bar's right-hand cluster (docs/specs/007-editor/editor-app.md "Tab bar"): the Start Tour button leads it,
// immediately left of Search, then History (on a stored document, docs/specs/006-document/version-history.md "In the
// editor"), then Settings; with no tour on offer, Search leads.

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
  it('puts the Start Tour button first, immediately left of Search, then Settings', () => {
    render(<Bar />);
    act(() => publishTourOffer('draw', { id: 'draw', name: 'Draw', rank: 1, start: () => {} }));
    const order = controls();
    expect(order[0]).toBe('Start Draw Tour');
    expect(order[1]).toBe('Search');
    expect(order.indexOf('Settings')).toBeGreaterThan(1);
  });

  it('leads with Search while no tour is on offer', () => {
    render(<Bar />);
    expect(controls()[0]).toBe('Search');
    expect(controls()).not.toContain('Start Draw Tour');
  });
});

describe('ChromeControls History', () => {
  it('sits between Search and Settings when the editor offers it', () => {
    render(<Bar onOpenHistory={() => {}} />);
    expect(controls()).toEqual(['Search', 'History', 'Settings']);
  });

  it('is not drawn without a handler (This Browser, the Explorer bar)', () => {
    render(<Bar />);
    expect(controls()).toEqual(['Search', 'Settings']);
  });
});
