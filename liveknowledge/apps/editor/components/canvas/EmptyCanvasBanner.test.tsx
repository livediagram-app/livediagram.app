// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyCanvasBanner } from './EmptyCanvasBanner';

// The empty-canvas card for a Participant or Viewer (liveworkspace/docs/specs/011-workbench/first-edit.md "The
// empty-canvas card"): the shared card with this product's picture and line.

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('EmptyCanvasBanner', () => {
  it("names the empty tab and gives everyone who cannot edit the passive line, with the product's picture", () => {
    render(<EmptyCanvasBanner tabId="t" tabName="Tab 1" />);
    const card = screen.getByRole('region', { name: 'Tab 1 is empty' });
    expect(card.querySelector('svg')).not.toBeNull();
    expect(
      screen.getByText(/The owner can build it out, and your view updates live\./),
    ).toBeTruthy();
  });
});
