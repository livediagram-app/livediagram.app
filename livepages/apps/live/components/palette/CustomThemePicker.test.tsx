// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The theme list (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel") is one flat grid of every
// theme; its "New Theme" card is the builder's door (docs/specs/011-theme/custom-themes.md). A workbench writes no
// themes (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table), so it offers neither New nor Copy.

// jsdom has no ResizeObserver; the browser's animated height measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const writable = vi.hoisted(() => ({ value: true }));
const custom = vi.hoisted(() => ({
  themes: [] as unknown[],
  deleteTheme: vi.fn(),
  confirmed: false,
}));
vi.mock('@/components/primitives/CustomThemeProvider', () => ({
  useCustomThemes: () => ({
    themes: custom.themes,
    loading: false,
    createTheme: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: custom.deleteTheme,
    writable: writable.value,
  }),
}));
vi.mock('@/hooks/ui/useConfirm', () => ({
  useConfirm: () => () => Promise.resolve(custom.confirmed),
}));

afterEach(() => {
  cleanup();
  custom.themes = [];
  custom.deleteTheme.mockReset();
});

const { CustomThemePicker } = await import('./CustomThemePicker');

describe('CustomThemePicker', () => {
  it('lists every built-in theme in one grid, with no categories', async () => {
    writable.value = true;
    const { THEMES } = await import('@/lib/themes');
    render(<CustomThemePicker themeId="brand" onSelect={vi.fn()} />);
    for (const t of THEMES.filter((t) => !t.seasonal))
      expect(screen.getAllByText(t.label).length, t.id).toBeGreaterThan(0);
    // The seasonal themes are worn only through the seasonal looks.
    for (const t of THEMES.filter((t) => t.seasonal))
      expect(screen.queryByText(t.label), t.id).toBeNull();
    for (const gone of ['Cool', 'Warm', 'Dark', 'Multi-colour', 'Formal', 'All themes'])
      expect(screen.queryByText(gone), gone).toBeNull();
  });

  it('offers a New Theme card where themes can be written', () => {
    writable.value = true;
    render(<CustomThemePicker themeId="brand" onSelect={vi.fn()} />);
    expect(screen.queryByText('New Theme')).not.toBeNull();
  });

  it('offers no New Theme card where they cannot', () => {
    writable.value = false;
    render(<CustomThemePicker themeId="brand" onSelect={vi.fn()} />);
    expect(screen.queryByText('New Theme')).toBeNull();
  });

  // Deleting the theme the tab wears asks first; only a confirmed delete falls the tab back to Default.
  describe('deleting the active custom theme', () => {
    const dusk = {
      id: 'custom:dusk',
      ownerId: 'o',
      name: 'Dusk',
      createdAt: 1,
      updatedAt: 1,
      definition: {
        backgroundColor: '#101820',
        backgroundPattern: 'grid',
        patternColor: '#334155',
        elementFill: '#1e293b',
        elementStroke: '#94a3b8',
        elementText: '#f8fafc',
      },
    };

    it('keeps the tab on it when the delete is cancelled', async () => {
      writable.value = true;
      custom.themes = [dusk];
      custom.confirmed = false;
      const onSelect = vi.fn();
      render(<CustomThemePicker themeId={dusk.id} onSelect={onSelect} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete Dusk' }));
      await Promise.resolve();
      await Promise.resolve();
      expect(onSelect).not.toHaveBeenCalled();
      expect(custom.deleteTheme).not.toHaveBeenCalled();
    });

    it('falls back to Default once the delete is confirmed', async () => {
      writable.value = true;
      custom.themes = [dusk];
      custom.confirmed = true;
      const onSelect = vi.fn();
      render(<CustomThemePicker themeId={dusk.id} onSelect={onSelect} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete Dusk' }));
      await waitFor(() => expect(custom.deleteTheme).toHaveBeenCalledWith(dusk.id));
      expect(onSelect).toHaveBeenCalledWith('brand');
    });
  });
});
