// @vitest-environment jsdom

// Connect File at the foot of a start panel's rail (connected-tabs.md "Connecting"): one button, marked
// chosen, every app's logo fanned in its icon slot, the host's included.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONNECT_RAIL_ID, ConnectRailEntry } from './ConnectRailEntry';

afterEach(cleanup);

const COLOURS = {
  text: '#0f172a',
  border: '#e2e8f0',
  card: '#ffffff',
  chosenText: '#1d4ed8',
  chosenTint: '#dbeafe',
  hoverTint: '#f1f5f9',
  chosenHoverTint: '#bfdbfe',
};

describe('ConnectRailEntry', () => {
  it('is one rail button that picks the connect view', () => {
    const onPick = vi.fn();
    const { container } = render(<ConnectRailEntry on={false} onPick={onPick} colours={COLOURS} />);
    const button = screen.getByRole('button', { name: 'Connect File' });
    expect(button.getAttribute('data-rail')).toBe(CONNECT_RAIL_ID);
    expect(button.getAttribute('aria-current')).toBeNull();
    // The owner's words, in full, on the row (on one line in a 240px rail).
    expect(button.textContent).toBe('Connect File');
    fireEvent.click(button);
    expect(onPick).toHaveBeenCalled();
    // Every app's logo, the host's included.
    expect(container.querySelectorAll('[aria-hidden] > span')).toHaveLength(5);
  });

  it('wears the chosen tint and ink when chosen', () => {
    render(<ConnectRailEntry on onPick={vi.fn()} colours={COLOURS} />);
    const button = screen.getByRole('button', { name: 'Connect File' });
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(button.style.backgroundColor).toBe('rgb(219, 234, 254)');
    expect(button.style.color).toBe('rgb(29, 78, 216)');
  });
});
