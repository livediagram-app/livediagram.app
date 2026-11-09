// @vitest-environment jsdom

// A phone's Appearance rows (pages-mode.md "Beside the cog"): one row per look control, each handing its id back.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppearanceRowList } from './AppearanceRowList';

afterEach(cleanup);

describe('AppearanceRowList', () => {
  it('lists each row by name and line, and hands a pressed row back', () => {
    const onPick = vi.fn();
    render(
      <AppearanceRowList
        rows={[
          { id: 'style', name: 'Style', line: 'Theme and fonts', icon: <svg /> },
          { id: 'background', name: 'Background', line: 'Colour or picture', icon: <svg /> },
        ]}
        onPick={onPick}
      />,
    );
    const rows = screen.getAllByRole('button');
    expect(rows.map((r) => r.textContent)).toEqual([
      'StyleTheme and fonts',
      'BackgroundColour or picture',
    ]);
    fireEvent.click(rows[1]!);
    expect(onPick).toHaveBeenCalledWith('background');
  });

  // Quick Style on a phone (quick-style-panel.md "On a phone, in Appearance"): the selection's rows after the page's.
  it('heads a later group with a hairline and names its list by the heading', () => {
    const { container } = render(
      <AppearanceRowList
        heading="Selected Element"
        rows={[{ id: 'fill', name: 'Fill', line: 'The inside colour', icon: <svg /> }]}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByRole('list', { name: 'Selected Element' })).toBeTruthy();
    expect(screen.getByText('Selected Element').getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[data-appearance-group]')!.className).toMatch(/border-t/);
  });
});
