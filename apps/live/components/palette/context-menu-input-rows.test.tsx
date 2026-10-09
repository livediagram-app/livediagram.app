// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { penColourHex, standardColours } from '@livediagram/document';
import { ColourRow } from './context-menu-input-rows';

// docs/specs/008-canvas/canvas-and-palette.md Colours, on the one colour picker
// (docs/specs/004-interface-design/colour-picker.md).
const PRESETS = ['#f0f9ff', '#0ea5e9'];

function renderRow(overrides: Partial<Parameters<typeof ColourRow>[0]> = {}) {
  const onCommit = vi.fn();
  const onChange = vi.fn();
  const onToggle = vi.fn();
  render(
    <ColourRow
      label="Background"
      value="#0ea5e9"
      open
      onToggle={onToggle}
      onChange={onChange}
      onCommit={onCommit}
      presets={PRESETS}
      {...overrides}
    />,
  );
  return { onCommit, onChange, onToggle };
}

afterEach(cleanup);

describe('ColourRow', () => {
  it('opens the picker: no colour and the theme first, then the standard colours, then Custom colours', () => {
    renderRow();
    const theme = within(screen.getByRole('group', { name: 'Theme Palette' })).getAllByRole(
      'button',
    );
    expect(theme.map((b) => b.getAttribute('aria-label'))).toEqual([
      'No background colour',
      'Blue',
      'Cyan',
    ]);
    expect(theme[2]!.getAttribute('aria-pressed')).toBe('true');
    expect(
      within(screen.getByRole('group', { name: 'Standard Colours' })).getAllByRole('button'),
    ).toHaveLength(10);
    expect(screen.getByRole('group', { name: 'Custom Colours' })).toBeTruthy();
  });

  it('picks transparent, committing and closing', () => {
    const { onCommit, onToggle } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'No background colour' }));
    expect(onCommit).toHaveBeenCalledWith('transparent');
    expect(onToggle).toHaveBeenCalled();
  });

  it('offers the soft colours by hex for a background', () => {
    const { onCommit } = renderRow({ tone: 'soft' });
    fireEvent.click(screen.getByRole('button', { name: 'Green' }));
    expect(onCommit).toHaveBeenCalledWith(standardColours('soft', 'light')[5]!.hex);
  });

  it('falls back to onChange without a commit handler', () => {
    const { onChange } = renderRow({ onCommit: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith(penColourHex('red', 'light'));
  });

  it('shows nothing until opened, and the category icon beside the label', () => {
    renderRow({ open: false, icon: <svg data-testid="category-icon" /> });
    expect(screen.getByTestId('category-icon')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// docs/specs/007-editor/editor-modes.md "One look": where a row can store a stock colour by name.
describe('ColourRow storing names', () => {
  it('picks the standard colours by name, Ink included, and marks the one drawn', () => {
    const { onCommit } = renderRow({
      label: 'Text',
      ink: '#1c1917',
      value: penColourHex('teal', 'light'),
    });
    expect(screen.getByRole('button', { name: 'Teal' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Ink' }));
    expect(onCommit).toHaveBeenCalledWith('ink');
    fireEvent.click(screen.getByRole('button', { name: 'Grey' }));
    expect(onCommit).toHaveBeenLastCalledWith('grey');
  });
});
