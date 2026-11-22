// @vitest-environment jsdom

// The theme list (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel"): the card that shows as selected.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeBrowser } from './ThemeBrowser';

afterEach(cleanup);

const pressed = () =>
  screen
    .getAllByRole('button', { pressed: true })
    .map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('ThemeBrowser', () => {
  it('selects the tab theme’s own card', () => {
    render(<ThemeBrowser themeId="forest" onSelect={() => {}} />);
    expect(pressed()).toHaveLength(1);
    expect(pressed()[0]).toMatch(/Forest/);
  });

  it('selects Default for an id that names no theme, as a removed custom theme’s does', () => {
    render(
      <ThemeBrowser themeId="custom:0b1e2c3d-0000-4000-8000-000000000000" onSelect={() => {}} />,
    );
    expect(pressed()).toHaveLength(1);
    expect(pressed()[0]).toMatch(/Default/);
  });
});
