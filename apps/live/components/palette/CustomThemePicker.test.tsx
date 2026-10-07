// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The theme picker's Custom category (docs/specs/011-theme/custom-themes.md) is the builder's door; a
// workbench writes no themes (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table),
// so it offers neither the category nor Copy.

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
  it('offers the Custom category where themes can be written', () => {
    writable.value = true;
    render(<CustomThemePicker themeId="brand" onSelect={vi.fn()} />);
    expect(screen.queryByText('Custom')).not.toBeNull();
  });

  it('offers no Custom category where they cannot', () => {
    writable.value = false;
    render(<CustomThemePicker themeId="brand" onSelect={vi.fn()} />);
    expect(screen.queryByText('Custom')).toBeNull();
  });
});
