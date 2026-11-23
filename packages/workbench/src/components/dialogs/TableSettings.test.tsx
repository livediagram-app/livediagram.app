// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableSettings, type TableLook } from './TableSettings';

function setup(look: TableLook = {}) {
  const on = {
    onHeaderRow: vi.fn(),
    onHeaderColumn: vi.fn(),
    onZebra: vi.fn(),
    onToggleStyle: vi.fn(),
  };
  render(
    <TableSettings
      look={look}
      {...on}
      colour={<button type="button">Text colour</button>}
      size={<div data-testid="size">Text Size</div>}
    />,
  );
  return on;
}

describe('TableSettings', () => {
  it('shows a plain table with every switch off and no style pressed', () => {
    setup();
    for (const name of [/Header Row/, /Header Column/, /Zebra Striping/])
      expect(screen.getByRole('switch', { name }).getAttribute('aria-checked')).toBe('false');
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough'])
      expect(screen.getByRole('button', { name }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Applies to every cell.')).toBeTruthy();
  });

  it("shows the table's look: its bands on and its styles pressed", () => {
    setup({
      headerRow: true,
      headerColumn: true,
      zebra: true,
      textBold: true,
      textItalic: true,
      textUnderline: true,
      textStrikethrough: true,
    });
    for (const name of [/Header Row/, /Header Column/, /Zebra Striping/])
      expect(screen.getByRole('switch', { name }).getAttribute('aria-checked')).toBe('true');
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough'])
      expect(screen.getByRole('button', { name }).getAttribute('aria-pressed')).toBe('true');
  });

  it('hands each switch its own change', () => {
    const on = setup({ zebra: true });
    fireEvent.click(screen.getByRole('switch', { name: /Header Row/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Header Column/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Zebra Striping/ }));
    expect(on.onHeaderRow).toHaveBeenCalledWith(true);
    expect(on.onHeaderColumn).toHaveBeenCalledWith(true);
    expect(on.onZebra).toHaveBeenCalledWith(false);
  });

  it('toggles each text style by the name the element stores', () => {
    const on = setup();
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough'])
      fireEvent.click(screen.getByRole('button', { name }));
    expect(on.onToggleStyle.mock.calls).toEqual([
      ['textBold'],
      ['textItalic'],
      ['textUnderline'],
      ['textStrikethrough'],
    ]);
  });

  it("holds the editor's colour picker and Text Size control in the Text group", () => {
    setup();
    expect(screen.getByRole('button', { name: 'Text colour' })).toBeTruthy();
    expect(screen.getByTestId('size').textContent).toBe('Text Size');
  });

  it('draws each style as a letter in that style', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Bold' }).textContent).toBe('B');
    expect(screen.getByRole('button', { name: 'Italic' }).textContent).toBe('I');
    const underline = screen.getByRole('button', { name: 'Underline' }).querySelector('span');
    expect(underline?.style.textDecoration).toBe('underline');
    const strike = screen.getByRole('button', { name: 'Strikethrough' }).querySelector('span');
    expect(strike?.style.textDecoration).toBe('line-through');
  });
});
