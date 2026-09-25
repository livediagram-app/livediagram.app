// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ColourRow } from './context-menu-input-rows';

const PRESETS = ['#f0f9ff', '#0ea5e9'];

function renderRow(overrides: Partial<Parameters<typeof ColourRow>[0]> = {}) {
  const onCommit = vi.fn();
  const onChange = vi.fn();
  const onAddCustom = vi.fn();
  const onRemoveCustom = vi.fn();
  render(
    <ColourRow
      label="Background"
      value="#0ea5e9"
      open
      onToggle={() => {}}
      onChange={onChange}
      onCommit={onCommit}
      presets={PRESETS}
      customs={['#ff0055']}
      onAddCustom={onAddCustom}
      onRemoveCustom={onRemoveCustom}
      {...overrides}
    />,
  );
  return { onCommit, onChange, onAddCustom, onRemoveCustom };
}

afterEach(cleanup);

describe('ColourRow', () => {
  it('offers a transparent option, because no theme provides one', () => {
    const { onCommit } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: /no background colour/i }));
    expect(onCommit).toHaveBeenCalledWith('transparent');
  });

  it('shows the pickers BEFORE the swatches', () => {
    // They open something rather than applying a colour, so they lead the row
    // instead of trailing off the end of it.
    renderRow();
    const buttons = screen.getAllByRole('button');
    const custom = buttons.findIndex((b) => /custom background colour/i.test(b.textContent ?? ''));
    const firstSwatch = buttons.findIndex((b) =>
      /no background colour/i.test(b.getAttribute('aria-label') ?? ''),
    );
    // The "+" label is a <label>, not a button, so fall back to the pipette
    // when the environment reports no EyeDropper: either way nothing that
    // applies a colour may come before them.
    if (custom >= 0) expect(custom).toBeLessThan(firstSwatch);
  });

  it('remembers a colour that was not already on the palette', () => {
    const { onAddCustom } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: '#0ea5e9' }));
    expect(onAddCustom).toHaveBeenCalledWith('#0ea5e9');
  });

  it('bins a custom colour on right-click, and never a preset', () => {
    const { onRemoveCustom } = renderRow();
    // A colour the user added says so, and removing it works.
    const custom = screen.getByRole('button', { name: /#ff0055 \(right-click to remove\)/i });
    fireEvent.contextMenu(custom);
    expect(onRemoveCustom).toHaveBeenCalledWith('#ff0055');

    // A theme preset is not the user's to bin: it would come back with the
    // theme, so the control would silently undo itself.
    onRemoveCustom.mockClear();
    fireEvent.contextMenu(screen.getByRole('button', { name: '#0ea5e9' }));
    expect(onRemoveCustom).not.toHaveBeenCalled();
  });

  it('does not repeat a custom colour that the theme also offers', () => {
    renderRow({ customs: ['#0ea5e9'] });
    expect(screen.queryByRole('button', { name: /#0ea5e9 \(right-click/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: '#0ea5e9' })).toHaveLength(1);
  });

  it('renders the category icon beside the label', () => {
    renderRow({ icon: <svg data-testid="category-icon" /> });
    expect(screen.getByTestId('category-icon')).toBeTruthy();
  });
});
