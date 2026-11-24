// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChoiceTiles, SettingsField, SettingsGroup } from './settings-layout';

afterEach(cleanup);

describe('settings layout', () => {
  it('titles a group, with its hint when it has one', () => {
    render(
      <>
        <SettingsGroup title="Bands" hint="What colours each flow.">
          <span>body</span>
        </SettingsGroup>
        <SettingsGroup title="Text">
          <span>plain</span>
        </SettingsGroup>
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Bands' })).toBeTruthy();
    expect(screen.getByText('What colours each flow.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Text' })).toBeTruthy();
  });

  it('shows every choice, checks the chosen one and reports a pick', () => {
    const onPick = vi.fn();
    render(
      <ChoiceTiles
        label="Layout"
        selected="a"
        options={[
          { id: 'a', label: 'Ends Right', icon: <i /> },
          { id: 'b', label: 'By Step' },
        ]}
        onPick={onPick}
      />,
    );
    const tiles = screen.getAllByRole('radio');
    expect(tiles.map((t) => t.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    fireEvent.click(screen.getByRole('radio', { name: 'By Step' }));
    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('labels a field', () => {
    render(
      <SettingsField label="Unit">
        <input />
      </SettingsField>,
    );
    expect(screen.getByLabelText('Unit')).toBeTruthy();
  });
});
