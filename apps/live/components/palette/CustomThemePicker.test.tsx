// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The theme list (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel") is one flat grid of every
// theme; its "New theme" card is the builder's door (docs/specs/011-theme/custom-themes.md). A workbench writes no
// themes (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table), so it offers neither New nor Copy.

// jsdom has no ResizeObserver; the browser's animated height measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const writable = vi.hoisted(() => ({ value: true }));
vi.mock('@/components/primitives/CustomThemeProvider', () => ({
  useCustomThemes: () => ({
    themes: [],
    loading: false,
    createTheme: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: vi.fn(),
    writable: writable.value,
  }),
}));

const { CustomThemePicker } = await import('./CustomThemePicker');

describe('CustomThemePicker', () => {
  it('lists every built-in theme in one grid, with no categories', async () => {
    writable.value = true;
    const { THEMES } = await import('@/lib/themes');
    render(<CustomThemePicker themeId="brand" onSelect={vi.fn()} />);
    for (const t of THEMES) expect(screen.getAllByText(t.label).length, t.id).toBeGreaterThan(0);
    for (const gone of ['Cool', 'Warm', 'Dark', 'Multi-colour', 'Formal', 'All themes'])
      expect(screen.queryByText(gone), gone).toBeNull();
  });

  it('offers a New theme card where themes can be written', () => {
    writable.value = true;
    render(<CustomThemePicker themeId="brand" onSelect={vi.fn()} />);
    expect(screen.queryByText('New theme')).not.toBeNull();
  });

  it('offers no New theme card where they cannot', () => {
    writable.value = false;
    render(<CustomThemePicker themeId="brand" onSelect={vi.fn()} />);
    expect(screen.queryByText('New theme')).toBeNull();
  });
});
