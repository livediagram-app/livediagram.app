// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickRadioRow } from './quick-style-rows';

// docs/specs/008-canvas/quick-style-panel.md "Accessibility": each row is a named radio group; arrows
// move and choose; one tab stop per row; titles are separate from the names.

const options = [
  { value: 'thin', name: 'Thin', content: null },
  { value: 'medium', name: 'Medium', content: null },
  { value: 'thick', name: 'Thick', content: null },
] as const;

function renderRow(value: 'thin' | 'medium' | 'thick' | null, showTitle = true) {
  const onChoose = vi.fn();
  render(
    <QuickRadioRow
      title="Stroke width"
      showTitle={showTitle}
      options={options}
      value={value}
      onChoose={onChoose}
      testId="row"
    />,
  );
  return onChoose;
}

describe('QuickRadioRow', () => {
  it('is a radio group named by its title, with named radios', () => {
    renderRow('medium');
    const group = screen.getByRole('radiogroup', { name: 'Stroke width' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Thin' }).getAttribute('aria-checked')).toBe('false');
  });

  it('keeps its name when the visible title is hidden', () => {
    renderRow('medium', false);
    expect(screen.queryByText('Stroke width')).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Stroke width' })).toBeTruthy();
  });

  it('has one tab stop: the checked option, else the first', () => {
    renderRow('thick');
    expect(screen.getByRole('radio', { name: 'Thick' }).tabIndex).toBe(0);
    expect(screen.getByRole('radio', { name: 'Thin' }).tabIndex).toBe(-1);
  });

  it('puts the tab stop on the first option when nothing is shared', () => {
    renderRow(null);
    expect(screen.getByRole('radio', { name: 'Thin' }).tabIndex).toBe(0);
  });

  it('moves and chooses with the arrow keys, wrapping, and Home / End', () => {
    const onChoose = renderRow('thick');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Thick' }), { key: 'ArrowRight' });
    expect(onChoose).toHaveBeenLastCalledWith('thin');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Thin' }), { key: 'ArrowLeft' });
    expect(onChoose).toHaveBeenLastCalledWith('thick');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Thin' }), { key: 'End' });
    expect(onChoose).toHaveBeenLastCalledWith('thick');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Thick' }), { key: 'Home' });
    expect(onChoose).toHaveBeenLastCalledWith('thin');
  });

  it('chooses on click', () => {
    const onChoose = renderRow('thin');
    fireEvent.click(screen.getByRole('radio', { name: 'Thick' }));
    expect(onChoose).toHaveBeenCalledWith('thick');
  });
});
