// @vitest-environment jsdom

// Connect liveworkspace File at the foot of a start panel's rail (connected-tabs.md "Connecting"): one button, marked
// chosen, the other apps' logos fanned at its end with the host's own left out.
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
    const { container } = render(
      <ConnectRailEntry hostApp="livediagram" on={false} onPick={onPick} colours={COLOURS} />,
    );
    const button = screen.getByRole('button', { name: 'Connect liveworkspace File' });
    expect(button.getAttribute('data-rail')).toBe(CONNECT_RAIL_ID);
    expect(button.getAttribute('aria-current')).toBeNull();
    // Short on the row, so it fits one line beside the logos in a 240px rail; the full name is its name.
    expect(button.textContent).toBe('Connect a File');
    fireEvent.click(button);
    expect(onPick).toHaveBeenCalled();
    // Three logos, never the host's own.
    expect(container.querySelectorAll('[aria-hidden] > span')).toHaveLength(3);
  });

  it('wears the chosen tint and ink when chosen', () => {
    render(<ConnectRailEntry hostApp="liveplanner" on onPick={vi.fn()} colours={COLOURS} />);
    const button = screen.getByRole('button', { name: 'Connect liveworkspace File' });
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(button.style.backgroundColor).toBe('rgb(219, 234, 254)');
    expect(button.style.color).toBe('rgb(29, 78, 216)');
  });
});
