// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SettingsCategoryPane } from './SettingsCategoryPane';
import { visibleCategories } from './settings-catalogue';
import { setPowerUserMode } from '@/lib/power-user-mode';
import type { UserPreferences } from '@/lib/user-preferences';

// The mode's children nest under its row as one named group
// (docs/specs/007-editor/power-user-mode.md#in-settings).

function setViewport() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function renderEditor(settings: UserPreferences, onGoToRow = vi.fn()) {
  setViewport();
  const powerUserMode = settings.powerUserMode === true;
  const editor = visibleCategories(true, {
    emailEnabled: false,
    signedIn: false,
    powerUserMode,
  }).find((c) => c.id === 'editor')!;
  render(
    <SettingsCategoryPane
      category={editor}
      settings={settings}
      onChange={() => {}}
      onGoToRow={onGoToRow}
    />,
  );
  return onGoToRow;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Power User Mode children', () => {
  it('are absent while the mode is off', () => {
    renderEditor({});
    expect(screen.getByRole('switch', { name: 'Power User Mode' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Power User Mode settings' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Minimal Chrome' })).toBeNull();
  });

  it('nest directly under the mode row, Minimal Chrome first, then the preset readout', () => {
    renderEditor(setPowerUserMode({}, true).prefs);
    const group = screen.getByRole('group', { name: 'Power User Mode settings' });
    const mode = screen.getByRole('switch', { name: 'Power User Mode' });
    // Keyboard order is visual order: the mode's switch comes right before the group.
    expect(mode.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const minimal = within(group).getByRole('switch', { name: 'Minimal Chrome' });
    const readout = within(group).getByRole('list', { name: 'Set By Power User Mode' });
    expect(
      minimal.compareDocumentPosition(readout) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(readout).getAllByRole('listitem')).toHaveLength(5);
    expect(within(readout).getAllByText('On').length).toBeGreaterThan(0);
  });

  it('goes to a preset setting in its own row', () => {
    const onGoToRow = renderEditor(setPowerUserMode({}, true).prefs);
    fireEvent.click(screen.getByRole('button', { name: 'Change Alignment Guides in Editor' }));
    expect(onGoToRow).toHaveBeenCalledWith('editor', 'alignmentGuides');
  });
});
