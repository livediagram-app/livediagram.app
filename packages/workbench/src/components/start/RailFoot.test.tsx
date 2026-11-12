// @vitest-environment jsdom

// The rail's foot group and its row (connected-tabs.md "Connecting"): an entry that opens a dialog says so and is
// never chosen; a chosen one wears the chosen tint.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RailFoot, RailFootButton } from './RailFoot';

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

describe('RailFootButton', () => {
  it('is a row that opens a dialog: never chosen, its glyph then its name', () => {
    const onPick = vi.fn();
    render(
      <RailFoot colours={COLOURS}>
        <RailFootButton
          railId="import"
          onPick={onPick}
          colours={COLOURS}
          icon={<svg data-testid="glyph" />}
          name="Import"
          opensDialog
          className="sm:mt-1"
        />
      </RailFoot>,
    );
    const button = screen.getByRole('button', { name: 'Import' });
    expect(button.getAttribute('data-rail')).toBe('import');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-current')).toBeNull();
    expect(button.className).toContain(' sm:mt-1');
    expect(button.style.color).toBe('rgb(15, 23, 42)');
    expect(button.firstElementChild?.getAttribute('data-testid')).toBe('glyph');
    fireEvent.click(button);
    expect(onPick).toHaveBeenCalled();
  });

  it('wears the chosen tint when chosen, and says nothing of a dialog by default', () => {
    render(
      <RailFootButton railId="x" on onPick={vi.fn()} colours={COLOURS} icon={null} name="X" />,
    );
    const button = screen.getByRole('button', { name: 'X' });
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(button.getAttribute('aria-haspopup')).toBeNull();
    expect(button.style.backgroundColor).toBe('rgb(219, 234, 254)');
    expect(button.className.endsWith('max-sm:w-auto')).toBe(true);
  });
});
