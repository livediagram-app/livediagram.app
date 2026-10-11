// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyCanvasBanner } from './EmptyCanvasBanner';

// new-document-route.md "The empty-canvas hint": the card's × closes it for good on that tab.
beforeEach(() => localStorage.clear());
afterEach(cleanup);

const show = (tabId: string) =>
  render(
    <EmptyCanvasBanner
      key={tabId}
      tabId={tabId}
      tabName="Tab"
      readOnly={false}
      onQuickStart={vi.fn()}
    />,
  );

describe('closing the empty-tab card', () => {
  it('hides it on that tab, then and on every later visit, and nowhere else', () => {
    show('a');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region')).toBeNull();
    cleanup();
    show('a');
    expect(screen.queryByRole('region')).toBeNull();
    cleanup();
    show('b');
    expect(screen.getByRole('region', { name: 'Tab is empty' })).toBeTruthy();
  });
});
