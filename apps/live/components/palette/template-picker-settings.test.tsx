// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewDiagramSettingsStep } from './template-picker-settings';

// The Settings step (spec/141): the Save location tiles, the folder step
// headed by the chosen location, and what Local Browser does to the step.

function show(saveLocation: 'livediagram' | 'browser', onSaveLocation = vi.fn()) {
  render(
    <NewDiagramSettingsStep
      diagramName=""
      onDiagramName={() => {}}
      placeholder="Untitled diagram"
      placement="unsorted"
      onPlacement={() => {}}
      folders={[]}
      teams={[]}
      saveLocation={saveLocation}
      onSaveLocation={onSaveLocation}
    />,
  );
  return onSaveLocation;
}

afterEach(cleanup);

describe('Save location', () => {
  it('offers livediagram and Local Browser as radios, the chosen one checked', () => {
    show('livediagram');
    const group = screen.getByRole('radiogroup', { name: 'Save location' });
    const radios = group.querySelectorAll('[role="radio"]');
    expect([...radios].map((r) => r.textContent)).toEqual([
      'livediagramYour account',
      'Local BrowserThis device only',
    ]);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[1]?.getAttribute('aria-checked')).toBe('false');
  });

  it('hands the picked location id up', () => {
    const onSaveLocation = show('livediagram');
    fireEvent.click(screen.getByRole('radio', { name: /Local Browser/ }));
    expect(onSaveLocation).toHaveBeenCalledWith('browser');
  });
});

describe('the folder step', () => {
  it('is headed by the chosen location and shows no data-loss warning for livediagram', () => {
    show('livediagram');
    expect(screen.getByRole('radiogroup', { name: 'Choose livediagram Folder' })).toBeTruthy();
    expect(screen.getByText('Choose livediagram Folder')).toBeTruthy();
    expect(screen.queryByText(/not backed up or synced/)).toBeNull();
  });

  it('is absent for Local Browser, which shows the data-loss warning instead', () => {
    show('browser');
    expect(screen.queryByText(/Choose .* Folder/)).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: /Folder/ })).toBeNull();
    expect(screen.getByText(/not backed up or synced/)).toBeTruthy();
    // The Save location row itself stays.
    expect(screen.getByRole('radiogroup', { name: 'Save location' })).toBeTruthy();
  });
});

describe('the folder step', () => {
  it('offers New Team on the space overview only when the host can create teams', () => {
    const base = {
      diagramName: '',
      onDiagramName: () => {},
      placeholder: 'Untitled diagram',
      placement: 'unsorted',
      onPlacement: () => {},
      folders: [],
      teams: [],
      saveLocation: 'livediagram' as const,
      onSaveLocation: () => {},
    };
    const { unmount } = render(<NewDiagramSettingsStep {...base} />);
    expect(screen.queryByRole('button', { name: /New Team/ })).toBeNull();
    unmount();
    render(<NewDiagramSettingsStep {...base} onCreateTeam={async () => null} />);
    expect(screen.getByRole('button', { name: /New Team/ })).toBeTruthy();
  });
});
