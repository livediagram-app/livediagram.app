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
});
